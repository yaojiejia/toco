/**
 * Python OpenAI provider implementation for detecting OpenAI API calls in Python code.
 */

import * as ts from 'typescript';
import { encode } from 'gpt-tokenizer';
import { LLMProvider, LLMApiCall } from './base';
import { detectOpenAICalls, parsePythonFunctions, findContainingFunction } from '../parsers/pythonParser';
import * as vscode from 'vscode';

/**
 * Python OpenAI provider that detects openai.chat.completions.create() and openai.completions.create() calls.
 */
export class PythonOpenAIProvider implements LLMProvider {
  readonly id = 'python-openai';
  readonly name = 'Python OpenAI';

  /**
   * Detects OpenAI API calls in Python code (not using AST, using regex parsing).
   */
  detectApiCalls(sourceFile: ts.SourceFile): LLMApiCall[] {
    // For Python, we need to get the text directly since TypeScript AST won't work
    const text = sourceFile.text;
    const pythonCalls = detectOpenAICalls(text);
    
    // Convert Python API calls to LLMApiCall format
    return pythonCalls.map(call => ({
      line: call.line,
      prompt: call.prompt,
      isApproximate: call.isApproximate,
      model: call.model,
      provider: this.id,
      node: sourceFile, // Use sourceFile as placeholder node
      messageCount: call.messageCount,
    }));
  }

  /**
   * Extracts prompt expression from a Python API call (not implemented for Python).
   */
  extractPromptExpression(callNode: ts.Node, sourceFile: ts.SourceFile): ts.Expression | null {
    // Python parsing doesn't use TypeScript AST, so return null
    return null;
  }

  /**
   * Counts tokens using GPT-compatible tokenization.
   */
  countTokens(text: string, model: string): number {
    try {
      const tokens = encode(text);
      return Array.isArray(tokens) ? tokens.length : tokens;
    } catch (error) {
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Counts the number of messages in a messages array (for Python).
   */
  countMessages(callNode: ts.Node, sourceFile: ts.SourceFile): number {
    // Extract message count from Python call
    const text = sourceFile.text;
    const pythonCalls = detectOpenAICalls(text);
    if (pythonCalls.length > 0) {
      return pythonCalls[0].messageCount || 0;
    }
    return 0;
  }
}

