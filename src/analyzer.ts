/**
 * Analyzes documents to detect LLM API calls and calculate token/cost estimates per function.
 */

import * as vscode from 'vscode';
import * as ts from 'typescript';
import { calculateCost, ModelName } from './pricing';
import { parseDocument, findVariableDefinitions, findImports, findAllFunctions, findFunctionCallsInFunction } from './astParser';
import { resolveVariableValue } from './moduleResolver';
import { getAllProviders } from './providers';
import { LLMApiCall } from './providers/base';

export interface LLMApiCallWithProvider extends LLMApiCall {
  provider: string;
}

export interface FunctionEstimate {
  functionName: string;
  line: number;
  totalTokens: number;
  totalCost: number;
  calls: LLMApiCallWithProvider[];
  isApproximate: boolean;
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
  // Check if this is a Python file
  const isPython = document.languageId === 'python' || document.fileName.endsWith('.py');
  
  let sourceFile: ts.SourceFile;
  let localVariables: Map<string, any>;
  let imports: Array<{ name: string; from: string; line: number }>;
  
  if (isPython) {
    // For Python, create a minimal SourceFile for compatibility
    sourceFile = ts.createSourceFile(
      document.fileName,
      document.getText(),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.Unknown
    );
    // Python variables/imports not yet supported
    localVariables = new Map();
    imports = [];
  } else {
    sourceFile = parseDocument(document);
    localVariables = findVariableDefinitions(sourceFile, document.fileName);
    imports = findImports(sourceFile);
  }
  
  const providers = getAllProviders();

  // Detect API calls from all providers
  // For Python files, only use Python providers; for JS/TS, use JS/TS providers
  const allApiCalls: LLMApiCall[] = [];
  for (const provider of providers) {
    // Filter providers based on file type
    if (isPython) {
      // Only use Python providers for Python files
      if (provider.id === 'python-openai' || provider.id === 'python-claude') {
        const calls = provider.detectApiCalls(sourceFile);
        allApiCalls.push(...calls);
      }
    } else {
      // Only use JS/TS providers for JS/TS files
      if (provider.id === 'openai' || provider.id === 'claude') {
        const calls = provider.detectApiCalls(sourceFile);
        allApiCalls.push(...calls);
      }
    }
  }

  const calls: LLMApiCallWithProvider[] = [];
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  for (const astCall of allApiCalls) {
    const provider = providers.find(p => p.id === astCall.provider);
    if (!provider) {
      continue;
    }

    let prompt = astCall.prompt;
    let isApproximate = astCall.isApproximate;

    if (prompt === null || isApproximate) {
      const promptExpr = provider.extractPromptExpression(astCall.node, sourceFile);
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
      ...astCall,
      prompt,
      isApproximate,
      model: callModel,
    });
  }

  const functionMap = new Map<string, FunctionEstimate>();

  // Import Python parser functions if needed
  let findContainingPythonFunction: ((line: number) => { name: string; startLine: number } | null) | null = null;
  if (isPython) {
    const pythonParser = await import('./parsers/pythonParser');
    const pythonFunctions = pythonParser.parsePythonFunctions(document.getText());
    findContainingPythonFunction = (line: number) => {
      const func = pythonParser.findContainingFunction(line, pythonFunctions);
      return func ? { name: func.name, startLine: func.startLine } : null;
    };
  }

  for (const call of calls) {
    const func = isPython && findContainingPythonFunction
      ? findContainingPythonFunction(call.line)
      : findContainingFunctionAST(call.node, sourceFile);

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

      const provider = providers.find(p => p.id === call.provider);
      if (!provider) {
        continue;
      }

      if (call.prompt !== null && call.prompt !== undefined) {
        if (call.prompt.length > 0) {
          const callTokens = provider.countTokens(call.prompt, call.model || model);
          totalTokens += callTokens;
          totalCost += calculateCost(callTokens, call.model || model);
        }
      } else {
        isApproximate = true;
        // Use message count to scale default tokens if available
        const messageCount = call.messageCount || 1;
        const defaultTokens = 100 * messageCount;
        totalTokens += defaultTokens;
        totalCost += calculateCost(defaultTokens, call.model || model);
      }
    }

    estimate.totalTokens = totalTokens;
    estimate.isApproximate = isApproximate;
    estimate.totalCost = totalCost;
    estimates.push(estimate);
  }

  // Build call graph and aggregate statistics from called functions
  // For Python, we need to parse functions differently
  let allFunctions: Array<{ name: string; line: number; node: ts.Node }>;
  if (isPython) {
    const pythonParser = await import('./parsers/pythonParser');
    const pythonFunctions = pythonParser.parsePythonFunctions(document.getText());
    allFunctions = pythonFunctions.map(f => ({
      name: f.name,
      line: f.startLine,
      node: sourceFile, // Placeholder
    }));
  } else {
    allFunctions = findAllFunctions(sourceFile);
  }
  const functionCallMap = new Map<string, Array<{ name: string; count: number }>>(); // functionName -> array of called functions with call count
  
  // Build the call graph (tracking call counts)
  if (isPython) {
    // Python function call tracking
    const pythonParser = await import('./parsers/pythonParser');
    const pythonFunctions = pythonParser.parsePythonFunctions(document.getText());
    
    for (const func of allFunctions) {
      const pythonFunc = pythonFunctions.find(f => f.name === func.name);
      if (pythonFunc) {
        const calledFunctions = pythonParser.findFunctionCallsInPythonFunction(pythonFunc, document.getText());
        if (calledFunctions.length > 0) {
          functionCallMap.set(func.name, calledFunctions);
        }
      }
    }
  } else {
    // JS/TS function call tracking
    for (const func of allFunctions) {
      const calledFunctions = findFunctionCallsInFunction(func.node, sourceFile);
      const calledMap = new Map<string, number>();
      
      for (const call of calledFunctions) {
        // Only track simple function calls (not method calls like obj.method)
        if (!call.name.includes('.')) {
          calledMap.set(call.name, (calledMap.get(call.name) || 0) + 1);
        }
      }
      
      if (calledMap.size > 0) {
        const calledArray = Array.from(calledMap.entries()).map(([name, count]) => ({ name, count }));
        functionCallMap.set(func.name, calledArray);
      }
    }
  }

  // Create a map for quick lookup of function estimates
  // Use function name + line as key to handle duplicate function names
  const estimateMap = new Map<string, FunctionEstimate>();
  for (const estimate of estimates) {
    const key = `${estimate.functionName}-${estimate.line}`;
    estimateMap.set(key, estimate);
    // Also store by name only for lookup
    if (!estimateMap.has(estimate.functionName)) {
      estimateMap.set(estimate.functionName, estimate);
    }
  }

  // Create estimates for functions that call other functions but have no direct API calls
  for (const func of allFunctions) {
    if (!estimateMap.has(func.name) && functionCallMap.has(func.name)) {
      const estimate: FunctionEstimate = {
        functionName: func.name,
        line: func.line,
        totalTokens: 0,
        totalCost: 0,
        calls: [],
        isApproximate: false,
      };
      estimateMap.set(func.name, estimate);
      estimates.push(estimate);
    }
  }

  // Aggregate statistics from called functions
  const visited = new Set<string>();
  function getFunctionStats(functionName: string): { tokens: number; cost: number; isApproximate: boolean } {
    if (visited.has(functionName)) {
      return { tokens: 0, cost: 0, isApproximate: false }; // Avoid infinite recursion
    }
    
    visited.add(functionName);
    
    // Start with direct API call statistics for this function
    const estimate = estimateMap.get(functionName);
    let tokens = estimate ? estimate.totalTokens : 0;
    let cost = estimate ? estimate.totalCost : 0;
    let isApproximate = estimate ? estimate.isApproximate : false;
    
    // Add statistics from called functions (multiplied by call count)
    const calledFunctions = functionCallMap.get(functionName);
    if (calledFunctions) {
      for (const { name: calledName, count } of calledFunctions) {
        const calledStats = getFunctionStats(calledName);
        tokens += calledStats.tokens * count;
        cost += calledStats.cost * count;
        if (calledStats.isApproximate) {
          isApproximate = true;
        }
      }
    }
    
    visited.delete(functionName);
    return { tokens, cost, isApproximate };
  }

  // Update estimates with aggregated statistics from called functions
  for (const func of allFunctions) {
    const estimate = estimateMap.get(func.name);
    if (estimate && functionCallMap.has(func.name)) {
      visited.clear();
      const aggregated = getFunctionStats(func.name);
      
      // Update with aggregated statistics (includes direct calls + called functions)
      estimate.totalTokens = aggregated.tokens;
      estimate.totalCost = aggregated.cost;
      estimate.isApproximate = aggregated.isApproximate;
    }
  }

  return estimates;
}
