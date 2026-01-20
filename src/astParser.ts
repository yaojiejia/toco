/**
 * AST parser using TypeScript Compiler API to find GPT API calls and extract code structure.
 */

import * as ts from 'typescript';
import * as vscode from 'vscode';

export interface GPTApiCallNode {
  line: number;
  prompt: string | null;
  isApproximate: boolean;
  model: string | null;
  callType: 'chat' | 'completion';
  node: ts.Node;
}

export interface VariableDefinition {
  name: string;
  value: string | null;
  line: number;
  isConstant: boolean;
  sourceFile: string;
}

/**
 * Parses a VS Code document into a TypeScript AST source file.
 */
export function parseDocument(document: vscode.TextDocument): ts.SourceFile {
  const fileName = document.fileName;
  const fileText = document.getText();

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    allowJs: true,
    checkJs: false,
    noEmit: true,
  };

  return ts.createSourceFile(
    fileName,
    fileText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : fileName.endsWith('.ts')
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS
  );
}

/**
 * Traverses the AST to find all GPT API calls (openai.chat.completions.create or openai.completions.create).
 */
export function findGPTApiCalls(sourceFile: ts.SourceFile): GPTApiCallNode[] {
  const calls: GPTApiCallNode[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;

      if (ts.isPropertyAccessExpression(expression)) {
        const propName = expression.name.text;

        if (propName === 'create') {
          const parent = expression.expression;

          if (ts.isPropertyAccessExpression(parent)) {
            const parentProp = parent.name.text;

            if (parentProp === 'completions') {
              const grandParent = parent.expression;

              if (ts.isIdentifier(grandParent) && grandParent.text === 'openai') {
                const callInfo = extractCallInfo(node, sourceFile, 'completion');
                if (callInfo) {
                  calls.push(callInfo);
                }
              } else if (ts.isPropertyAccessExpression(grandParent)) {
                const grandParentProp = grandParent.name.text;
                if (grandParentProp === 'chat') {
                  const greatGrandParent = grandParent.expression;
                  if (ts.isIdentifier(greatGrandParent) && greatGrandParent.text === 'openai') {
                    const callInfo = extractCallInfo(node, sourceFile, 'chat');
                    if (callInfo) {
                      calls.push(callInfo);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

/**
 * Extracts prompt, model, and metadata from a GPT API call AST node.
 */
function extractCallInfo(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  callType: 'chat' | 'completion'
): GPTApiCallNode | null {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  if (node.arguments.length === 0) {
    return null;
  }

  const configArg = node.arguments[0];
  if (!ts.isObjectLiteralExpression(configArg)) {
    return null;
  }

  let prompt: string | null = null;
  let model: string | null = null;
  let isApproximate = false;

  for (const prop of configArg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      continue;
    }

    const propName = prop.name.text;

    if (propName === 'model') {
      model = extractStringValue(prop.initializer);
    } else if (propName === 'prompt' && callType === 'completion') {
      const promptValue = extractPromptValue(prop.initializer, sourceFile);
      prompt = promptValue.value;
      isApproximate = promptValue.isApproximate;
    } else if (propName === 'messages' && callType === 'chat') {
      const messagesValue = extractMessagesValue(prop.initializer, sourceFile);
      prompt = messagesValue.prompt;
      isApproximate = messagesValue.isApproximate;
    }
  }

  return {
    line,
    prompt,
    isApproximate,
    model,
    callType,
    node,
  };
}

/**
 * Extracts string value from a string literal or template literal expression.
 */
function extractStringValue(expr: ts.Expression): string | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  return null;
}

/**
 * Extracts prompt value from an expression, handling strings, template strings, and variables.
 */
function extractPromptValue(
  expr: ts.Expression,
  sourceFile: ts.SourceFile
): { value: string | null; isApproximate: boolean } {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { value: expr.text, isApproximate: false };
  }

  if (ts.isTemplateExpression(expr)) {
    const hasExpressions = expr.templateSpans.length > 0;
    if (!hasExpressions) {
      return { value: expr.head.text, isApproximate: false };
    }
    return { value: null, isApproximate: true };
  }

  if (ts.isIdentifier(expr)) {
    return { value: null, isApproximate: true };
  }

  return { value: null, isApproximate: true };
}

/**
 * Extracts prompt from the first message's content property in a messages array.
 */
function extractMessagesValue(
  expr: ts.Expression,
  sourceFile: ts.SourceFile
): { prompt: string | null; isApproximate: boolean } {
  if (!ts.isArrayLiteralExpression(expr)) {
    return { prompt: null, isApproximate: true };
  }

  if (expr.elements.length === 0) {
    return { prompt: null, isApproximate: true };
  }

  const firstMessage = expr.elements[0];
  if (!ts.isObjectLiteralExpression(firstMessage)) {
    return { prompt: null, isApproximate: true };
  }

  for (const prop of firstMessage.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      continue;
    }

    if (prop.name.text === 'content') {
      const result = extractPromptValue(prop.initializer, sourceFile);
      return { prompt: result.value, isApproximate: result.isApproximate };
    }
  }

  return { prompt: null, isApproximate: true };
}

/**
 * Finds all variable declarations (const/let/var) in the AST and extracts their string values.
 */
export function findVariableDefinitions(
  sourceFile: ts.SourceFile,
  fileName: string
): Map<string, VariableDefinition> {
  const variables = new Map<string, VariableDefinition>();

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const varName = node.name.text;
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

      let value: string | null = null;
      if (node.initializer) {
        value = extractStringValue(node.initializer);
      }

      const parent = node.parent;
      const isConstant = parent && ts.isVariableDeclarationList(parent)
        ? (parent.flags & ts.NodeFlags.Const) !== 0
        : false;

      variables.set(varName, {
        name: varName,
        value,
        line,
        isConstant,
        sourceFile: fileName,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
}

/**
 * Finds all import and require statements in the AST and extracts imported variable names.
 */
export function findImports(sourceFile: ts.SourceFile): Array<{ name: string; from: string; line: number }> {
  const imports: Array<{ name: string; from: string; line: number }> = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const modulePath = node.moduleSpecifier.text;
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

      if (node.importClause) {
        if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            imports.push({
              name: element.name.text,
              from: modulePath,
              line,
            });
          }
        }
      }
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isCallExpression(decl.initializer)) {
          const callExpr = decl.initializer;
          if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'require') {
            if (callExpr.arguments.length > 0 && ts.isStringLiteral(callExpr.arguments[0])) {
              const modulePath = callExpr.arguments[0].text;
              const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

              if (ts.isIdentifier(decl.name)) {
                imports.push({
                  name: decl.name.text,
                  from: modulePath,
                  line,
                });
              } else if (ts.isObjectBindingPattern(decl.name)) {
                for (const element of decl.name.elements) {
                  if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                    imports.push({
                      name: element.name.text,
                      from: modulePath,
                      line,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}
