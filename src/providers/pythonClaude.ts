/**
 * Python Anthropic Claude provider implementation for detecting Claude API calls in Python code.
 */

import * as ts from 'typescript';
import { LLMProvider, LLMApiCall } from './base';
import { detectClaudeCalls } from '../parsers/pythonParser';

/**
 * Python Anthropic Claude provider that detects anthropic.messages.create() calls.
 */
export class PythonClaudeProvider implements LLMProvider {
  readonly id = 'python-claude';
  readonly name = 'Python Anthropic Claude';

  /**
   * Detects Claude API calls in Python code.
   */
  detectApiCalls(sourceFile: ts.SourceFile): LLMApiCall[] {
    const text = sourceFile.text;
    const pythonCalls = detectClaudeCalls(text);
    
    return pythonCalls.map(call => ({
      line: call.line,
      prompt: call.prompt,
      isApproximate: call.isApproximate,
      model: call.model,
      provider: this.id,
      node: sourceFile,
      messageCount: call.messageCount,
    }));
  }

  /**
   * Extracts prompt expression from a Python API call (not implemented for Python).
   */
  extractPromptExpression(callNode: ts.Node, sourceFile: ts.SourceFile): ts.Expression | null {
    return null;
  }

  /**
   * Counts tokens using Claude-compatible tokenization (approximation).
   */
  countTokens(text: string, model: string): number {
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Counts the number of messages in a messages array (for Python).
   */
  countMessages(callNode: ts.Node, sourceFile: ts.SourceFile): number {
    const text = sourceFile.text;
    const pythonCalls = detectClaudeCalls(text);
    if (pythonCalls.length > 0) {
      return pythonCalls[0].messageCount || 0;
    }
    return 0;
  }
}

