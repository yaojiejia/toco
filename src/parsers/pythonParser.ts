/**
 * Python parser for detecting API calls and extracting code structure.
 */

import * as vscode from 'vscode';

export interface PythonFunction {
  name: string;
  line: number;
  startLine: number;
  endLine: number;
}

export interface PythonApiCall {
  line: number;
  provider: 'openai' | 'claude';
  callType: 'chat' | 'completion' | 'messages';
  model: string | null;
  prompt: string | null;
  isApproximate: boolean;
  messageCount?: number;
}

/**
 * Parses a Python file to extract function definitions.
 */
export function parsePythonFunctions(text: string): PythonFunction[] {
  const functions: PythonFunction[] = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match function definitions: def function_name(...): or async def function_name(...):
    const funcMatch = line.match(/^\s*(?:async\s+)?def\s+(\w+)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const startLine = i + 1; // 1-indexed
      
      // Find the end of the function (next function or end of file)
      let endLine = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        // Check if this is the start of another function/class at the same indentation level
        const indentMatch = line.match(/^(\s*)/);
        const nextIndentMatch = nextLine.match(/^(\s*)/);
        if (indentMatch && nextIndentMatch) {
          const indent = indentMatch[1].length;
          const nextIndent = nextIndentMatch[1].length;
          if (nextIndent <= indent && (nextLine.match(/^\s*(?:async\s+)?(def|class)\s+/) || (nextLine.trim().length > 0 && nextIndent === 0))) {
            endLine = j;
            break;
          }
        }
      }
      
      functions.push({
        name: funcName,
        line: startLine,
        startLine,
        endLine,
      });
    }
  }
  
  return functions;
}

/**
 * Finds the function that contains a given line number.
 */
export function findContainingFunction(line: number, functions: PythonFunction[]): PythonFunction | null {
  for (const func of functions) {
    if (line >= func.startLine && line < func.endLine) {
      return func;
    }
  }
  return null;
}

/**
 * Finds function calls within a Python function's body.
 */
export function findFunctionCallsInPythonFunction(
  func: PythonFunction,
  text: string
): Array<{ name: string; count: number }> {
  const lines = text.split('\n');
  const funcLines = lines.slice(func.startLine - 1, func.endLine - 1);
  const funcText = funcLines.join('\n');
  
  const calledMap = new Map<string, number>();
  
  // Match function calls: function_name( or await function_name(
  // Exclude method calls (obj.method) and API calls (openai_client.chat.completions.create)
  const functionCallPattern = /(?:await\s+)?(\w+)\s*\(/g;
  let match;
  
  while ((match = functionCallPattern.exec(funcText)) !== null) {
    const funcName = match[1];
    // Skip if it's a method call (has a dot before it) or is a keyword
    const beforeMatch = funcText.substring(Math.max(0, match.index - 50), match.index);
    const hasDotBefore = beforeMatch.match(/\.\s*$/);
    const isKeyword = ['if', 'for', 'while', 'with', 'def', 'class', 'import', 'from', 'return', 'print', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple'].includes(funcName);
    
    if (!hasDotBefore && !isKeyword && funcName !== func.name) {
      calledMap.set(funcName, (calledMap.get(funcName) || 0) + 1);
    }
  }
  
  return Array.from(calledMap.entries()).map(([name, count]) => ({ name, count }));
}

/**
 * Extracts string value from Python string literal (handles single, double, triple quotes, f-strings).
 */
export function extractPythonStringValue(str: string): { value: string | null; isApproximate: boolean } {
  // Remove leading/trailing whitespace
  str = str.trim();
  
  // Handle f-strings (f"...", f'...', f"""...""", f'''...''')
  const fStringMatch = str.match(/^f(["'])/);
  if (fStringMatch) {
    const quoteChar = fStringMatch[1];
    const isTriple = str.startsWith(`f${quoteChar.repeat(3)}`);
    
    if (isTriple) {
      // f"""...""" or f'''...'''
      const endQuote = quoteChar.repeat(3);
      const startIndex = 4; // f + """
      const endIndex = str.lastIndexOf(endQuote);
      if (endIndex > startIndex) {
        const inner = str.slice(startIndex, endIndex);
        // Extract static parts (text outside {})
        const staticParts = inner.replace(/\{[^}]*\}/g, '');
        return { value: staticParts.length > 0 ? staticParts : null, isApproximate: true };
      }
    } else {
      // f"..." or f'...'
      const startIndex = 2; // f + quote
      const endIndex = str.lastIndexOf(quoteChar);
      if (endIndex > startIndex) {
        const inner = str.slice(startIndex, endIndex);
        // Extract static parts
        const staticParts = inner.replace(/\{[^}]*\}/g, '');
        return { value: staticParts.length > 0 ? staticParts : null, isApproximate: true };
      }
    }
    return { value: null, isApproximate: true };
  }
  
  // Handle regular strings (single, double, triple quotes)
  // Single quotes
  if (str.startsWith("'") && str.endsWith("'")) {
    if (str.startsWith("'''")) {
      return { value: str.slice(3, -3), isApproximate: false };
    }
    return { value: str.slice(1, -1), isApproximate: false };
  }
  
  // Double quotes
  if (str.startsWith('"') && str.endsWith('"')) {
    if (str.startsWith('"""')) {
      return { value: str.slice(3, -3), isApproximate: false };
    }
    return { value: str.slice(1, -1), isApproximate: false };
  }
  
  return { value: null, isApproximate: true };
}

/**
 * Detects OpenAI API calls in Python code.
 */
export function detectOpenAICalls(text: string): PythonApiCall[] {
  const calls: PythonApiCall[] = [];
  const lines = text.split('\n');
  
  // Pattern for openai.chat.completions.create(...) or client.chat.completions.create(...)
  // Matches: openai.chat.completions.create( or openai_client.chat.completions.create( or any_var.chat.completions.create(
  const chatPattern = /\.chat\.completions\.create\s*\(/;
  // Pattern for openai.completions.create(...) or client.completions.create(...)
  const completionPattern = /\.completions\.create\s*\(/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (chatPattern.test(line) || completionPattern.test(line)) {
      const callType = chatPattern.test(line) ? 'chat' : 'completion';
      
      // Extract the full call (may span multiple lines)
      let callText = line;
      let j = i;
      let openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      
      while (openParens > 0 && j < lines.length - 1) {
        j++;
        callText += '\n' + lines[j];
        openParens += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
      }
      
      const callInfo = extractCallInfo(callText, i + 1, 'openai', callType);
      if (callInfo) {
        calls.push(callInfo);
      }
    }
  }
  
  return calls;
}

/**
 * Detects Anthropic Claude API calls in Python code.
 */
export function detectClaudeCalls(text: string): PythonApiCall[] {
  const calls: PythonApiCall[] = [];
  const lines = text.split('\n');
  
  // Pattern for anthropic.messages.create(...) or client.messages.create(...)
  // Matches: anthropic.messages.create( or anthropic_client.messages.create( or any_var.messages.create(
  const messagesPattern = /\.messages\.create\s*\(/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (messagesPattern.test(line)) {
      // Extract the full call (may span multiple lines)
      let callText = line;
      let j = i;
      let openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      
      while (openParens > 0 && j < lines.length - 1) {
        j++;
        callText += '\n' + lines[j];
        openParens += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
      }
      
      const callInfo = extractCallInfo(callText, i + 1, 'claude', 'messages');
      if (callInfo) {
        calls.push(callInfo);
      }
    }
  }
  
  return calls;
}

/**
 * Extracts call information from API call text.
 */
function extractCallInfo(
  callText: string,
  line: number,
  provider: 'openai' | 'claude',
  callType: 'chat' | 'completion' | 'messages'
): PythonApiCall | null {
  let model: string | null = null;
  let prompt: string | null = null;
  let isApproximate = false;
  let messageCount = 0;
  
  // Extract model
  const modelMatch = callText.match(/model\s*[:=]\s*["']([^"']+)["']/);
  if (modelMatch) {
    model = modelMatch[1];
  }
  
  if (callType === 'completion') {
    // Extract prompt
    const promptMatch = callText.match(/prompt\s*[:=]\s*((?:["'](?:(?:(?!"')|(?:"")|(?:''))[^"'])*["']|f["'][^"']*["']))/);
    if (promptMatch) {
      const strValue = extractPythonStringValue(promptMatch[1]);
      prompt = strValue.value;
      isApproximate = strValue.isApproximate;
    } else {
      isApproximate = true;
    }
  } else {
    // Extract messages array
    const messagesMatch = callText.match(/messages\s*[:=]\s*\[(.*?)\]/s);
    if (messagesMatch) {
      const messagesText = messagesMatch[1];
      // Count message objects
      messageCount = (messagesText.match(/\{[^}]*"content"\s*[:=]/g) || []).length;
      
      // Extract content from first message
      const contentMatch = messagesText.match(/"content"\s*[:=]\s*((?:["'](?:(?:(?!"')|(?:"")|(?:''))[^"'])*["']|f["'][^"']*["']))/);
      if (contentMatch) {
        const strValue = extractPythonStringValue(contentMatch[1]);
        prompt = strValue.value;
        isApproximate = strValue.isApproximate;
        
        // Extract all messages if possible
        const allContentMatches = messagesText.matchAll(/"content"\s*[:=]\s*((?:["'](?:(?:(?!"')|(?:"")|(?:''))[^"'])*["']|f["'][^"']*["']))/g);
        const contents: string[] = [];
        for (const match of allContentMatches) {
          const strValue = extractPythonStringValue(match[1]);
          if (strValue.value) {
            contents.push(strValue.value);
          }
          if (strValue.isApproximate) {
            isApproximate = true;
          }
        }
        if (contents.length > 0) {
          prompt = contents.join('\n');
        }
      } else {
        isApproximate = true;
      }
    } else {
      isApproximate = true;
    }
  }
  
  return {
    line,
    provider,
    callType,
    model,
    prompt,
    isApproximate,
    messageCount: messageCount > 0 ? messageCount : undefined,
  };
}
