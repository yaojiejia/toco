/**
 * Analyzes documents to detect GPT API calls and calculate token/cost estimates per function.
 */

import * as vscode from 'vscode';
import * as ts from 'typescript';
import { countTokens } from './tokenizer';
import { calculateCost, ModelName } from './pricing';
import { parseDocument, findGPTApiCalls, findVariableDefinitions, findImports, GPTApiCallNode } from './astParser';
import { resolveVariableValue } from './moduleResolver';

export interface GPTApiCall {
  line: number;
  prompt: string | null;
  isApproximate: boolean;
  model: ModelName | string;
}

export interface FunctionEstimate {
  functionName: string;
  line: number;
  totalTokens: number;
  totalCost: number;
  calls: GPTApiCall[];
  isApproximate: boolean;
}

/**
 * Extracts the prompt expression node from a GPT API call AST node.
 */
function extractPromptExpression(
  callNode: ts.Node,
  sourceFile: ts.SourceFile,
  callType: 'chat' | 'completion'
): ts.Expression | null {
  if (!ts.isCallExpression(callNode) || callNode.arguments.length === 0) {
    return null;
  }

  const configArg = callNode.arguments[0];
  if (!ts.isObjectLiteralExpression(configArg)) {
    return null;
  }

  for (const prop of configArg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      continue;
    }

    const propName = prop.name.text;
    if (propName === 'prompt' && callType === 'completion') {
      return prop.initializer;
    } else if (propName === 'messages' && callType === 'chat') {
      if (ts.isArrayLiteralExpression(prop.initializer) && prop.initializer.elements.length > 0) {
        const firstMessage = prop.initializer.elements[0];
        if (ts.isObjectLiteralExpression(firstMessage)) {
          for (const msgProp of firstMessage.properties) {
            if (ts.isPropertyAssignment(msgProp) && ts.isIdentifier(msgProp.name) && msgProp.name.text === 'content') {
              return msgProp.initializer;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Finds the function declaration that contains the given AST node.
 */
function findContainingFunctionAST(
  node: ts.Node,
  sourceFile: ts.SourceFile
): { name: string; startLine: number } | null {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      const line = sourceFile.getLineAndCharacterOfPosition(current.getStart()).line + 1;
      return { name: current.name.text, startLine: line };
    }

    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      const parent = current.parent;
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        const line = sourceFile.getLineAndCharacterOfPosition(parent.getStart()).line + 1;
        return { name: parent.name.text, startLine: line };
      }
      const line = sourceFile.getLineAndCharacterOfPosition(current.getStart()).line + 1;
      return { name: 'anonymous', startLine: line };
    }

    current = current.parent;
  }

  return null;
}

/**
 * Analyzes a document and returns function-level token and cost estimates.
 */
export async function analyzeDocument(
  document: vscode.TextDocument,
  model: ModelName
): Promise<FunctionEstimate[]> {
  const sourceFile = parseDocument(document);
  const astCalls = findGPTApiCalls(sourceFile);
  const localVariables = findVariableDefinitions(sourceFile, document.fileName);
  const imports = findImports(sourceFile);

  const calls: GPTApiCall[] = [];
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  for (const astCall of astCalls) {
    let prompt = astCall.prompt;
    let isApproximate = astCall.isApproximate;

    if (prompt === null || isApproximate) {
      const promptExpr = extractPromptExpression(astCall.node, sourceFile, astCall.callType);
      if (promptExpr && ts.isIdentifier(promptExpr)) {
        const varName = promptExpr.text;
        const resolvedValue = await resolveVariableValue(
          varName,
          imports,
          document.fileName,
          localVariables,
          workspaceRoot
        );
        if (resolvedValue !== null) {
          prompt = resolvedValue;
          isApproximate = true;
        }
      }
    }

    const callModel = astCall.model || model;

    calls.push({
      line: astCall.line,
      prompt,
      isApproximate,
      model: callModel,
    });
  }

  const functionMap = new Map<string, FunctionEstimate>();

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const astCall = astCalls[i];

    const func = findContainingFunctionAST(astCall.node, sourceFile);

    if (!func) {
      const key = 'top-level';
      if (!functionMap.has(key)) {
        functionMap.set(key, {
          functionName: 'top-level',
          line: 0,
          totalTokens: 0,
          totalCost: 0,
          calls: [],
          isApproximate: false,
        });
      }
      functionMap.get(key)!.calls.push(call);
      continue;
    }

    const key = `${func.name}-${func.startLine}`;
    if (!functionMap.has(key)) {
      functionMap.set(key, {
        functionName: func.name,
        line: func.startLine,
        totalTokens: 0,
        totalCost: 0,
        calls: [],
        isApproximate: false,
      });
    }

    functionMap.get(key)!.calls.push(call);
  }

  const estimates: FunctionEstimate[] = [];
  for (const estimate of functionMap.values()) {
    let totalTokens = 0;
    let totalCost = 0;
    let isApproximate = false;

    for (const call of estimate.calls) {
      if (call.isApproximate) {
        isApproximate = true;
      }

      if (call.prompt !== null && call.prompt !== undefined) {
        if (call.prompt.length > 0) {
          const callTokens = countTokens(call.prompt, call.model);
          totalTokens += callTokens;
          totalCost += calculateCost(callTokens, call.model);
        }
      } else {
        isApproximate = true;
        const defaultTokens = 100;
        totalTokens += defaultTokens;
        totalCost += calculateCost(defaultTokens, call.model);
      }
    }

    estimate.totalTokens = totalTokens;
    estimate.isApproximate = isApproximate;
    estimate.totalCost = totalCost;
    estimates.push(estimate);
  }

  return estimates;
}
