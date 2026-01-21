/**
 * Base provider interface for LLM API detection and analysis.
 */

import * as ts from 'typescript';

/**
 * Represents a detected LLM API call in the AST.
 */
export interface LLMApiCall {
  line: number;
  prompt: string | null;
  isApproximate: boolean;
  model: string | null;
  provider: string;
  node: ts.Node;
  messageCount?: number; // Number of messages in the array (for better default token estimation)
}

/**
 * Provider interface for detecting and analyzing LLM API calls.
 */
export interface LLMProvider {
  /**
   * Unique identifier for this provider (e.g., 'openai', 'claude').
   */
  readonly id: string;

  /**
   * Display name for this provider (e.g., 'OpenAI', 'Anthropic Claude').
   */
  readonly name: string;

  /**
   * Detects API calls for this provider in the AST.
   */
  detectApiCalls(sourceFile: ts.SourceFile): LLMApiCall[];

  /**
   * Extracts the prompt expression from an API call node for variable resolution.
   */
  extractPromptExpression(callNode: ts.Node, sourceFile: ts.SourceFile): ts.Expression | null;

  /**
   * Counts tokens for text using this provider's tokenization method.
   */
  countTokens(text: string, model: string): number;

  /**
   * Counts the number of messages in a messages array from an API call node.
   * Returns 0 if unable to determine.
   */
  countMessages(callNode: ts.Node, sourceFile: ts.SourceFile): number;
}

