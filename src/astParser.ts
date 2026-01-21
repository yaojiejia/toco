/**
 * AST parser using TypeScript Compiler API to extract code structure (variables, imports, functions).
 * LLM API detection is now handled by provider-specific implementations.
 */

import * as ts from 'typescript';
import * as vscode from 'vscode';

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
        if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
          value = node.initializer.text;
        }
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
 * Finds all function calls within a specific function's body.
 */
export function findFunctionCallsInFunction(
  functionNode: ts.Node,
  sourceFile: ts.SourceFile
): Array<{ name: string; line: number }> {
  const calls: Array<{ name: string; line: number }> = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      
      if (ts.isIdentifier(expression)) {
        const funcName = expression.text;
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        calls.push({ name: funcName, line });
      } else if (ts.isPropertyAccessExpression(expression)) {
        const propName = expression.name.text;
        const obj = expression.expression;
        
        if (ts.isIdentifier(obj)) {
          const funcName = `${obj.text}.${propName}`;
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          calls.push({ name: funcName, line });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(functionNode);
  return calls;
}

/**
 * Finds all function declarations and expressions in the AST.
 */
export function findAllFunctions(sourceFile: ts.SourceFile): Array<{
  name: string;
  line: number;
  node: ts.Node;
}> {
  const functions: Array<{ name: string; line: number; node: ts.Node }> = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      functions.push({ name: node.name.text, line, node });
    } else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        const line = sourceFile.getLineAndCharacterOfPosition(parent.getStart()).line + 1;
        functions.push({ name: parent.name.text, line, node });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
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
