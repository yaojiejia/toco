/**
 * Anthropic Claude provider implementation for detecting Claude API calls.
 */

import * as ts from 'typescript';
import { LLMProvider, LLMApiCall } from './base';

/**
 * Anthropic Claude provider that detects anthropic.messages.create() calls.
 */
export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';
  readonly name = 'Anthropic Claude';

  /**
   * Detects Claude API calls in the AST.
   */
  detectApiCalls(sourceFile: ts.SourceFile): LLMApiCall[] {
    const calls: LLMApiCall[] = [];
    const self = this;

    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        if (ts.isPropertyAccessExpression(expression)) {
          const propName = expression.name.text;

          if (propName === 'create') {
            const parent = expression.expression;

            if (ts.isPropertyAccessExpression(parent)) {
              const parentProp = parent.name.text;

              if (parentProp === 'messages') {
                const grandParent = parent.expression;

                if (ts.isIdentifier(grandParent) && grandParent.text === 'anthropic') {
                  const callInfo = self.extractCallInfo(node, sourceFile);
                  if (callInfo) {
                    calls.push(callInfo);
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
   * Extracts prompt expression from a Claude API call for variable resolution.
   */
  extractPromptExpression(callNode: ts.Node, sourceFile: ts.SourceFile): ts.Expression | null {
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
      if (propName === 'messages') {
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
   * Counts tokens using Claude-compatible tokenization (approximation).
   * Note: Claude uses a different tokenizer than GPT, but we use a similar approximation.
   */
  countTokens(text: string, model: string): number {
    // Claude tokenization is similar to GPT but not identical
    // Using approximation: ~4 characters per token (Claude tends to tokenize slightly differently)
    // For more accuracy, we could use @anthropic-ai/sdk's tokenizer if available
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Counts the number of messages in a messages array from an API call node.
   */
  countMessages(callNode: ts.Node, sourceFile: ts.SourceFile): number {
    if (!ts.isCallExpression(callNode) || callNode.arguments.length === 0) {
      return 0;
    }

    const configArg = callNode.arguments[0];
    if (!ts.isObjectLiteralExpression(configArg)) {
      return 0;
    }

    for (const prop of configArg.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
        continue;
      }

      if (prop.name.text === 'messages') {
        if (ts.isArrayLiteralExpression(prop.initializer)) {
          return prop.initializer.elements.length;
        }
      }
    }

    return 0;
  }

  /**
   * Extracts call information from a Claude API call AST node.
   */
  private extractCallInfo(node: ts.CallExpression, sourceFile: ts.SourceFile): LLMApiCall | null {
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
        model = this.extractStringValue(prop.initializer);
      } else if (propName === 'messages') {
        const messagesValue = this.extractMessagesValue(prop.initializer, sourceFile);
        prompt = messagesValue.prompt;
        isApproximate = messagesValue.isApproximate;
      }
    }

    let messageCount = 0;
    // Count messages for better default token estimation
    for (const prop of configArg.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'messages') {
        if (ts.isArrayLiteralExpression(prop.initializer)) {
          messageCount = prop.initializer.elements.length;
        }
        break;
      }
    }

    return {
      line,
      prompt,
      isApproximate,
      model,
      provider: this.id,
      node,
      messageCount: messageCount > 0 ? messageCount : undefined,
    };
  }

  /**
   * Extracts string value from a string literal or template literal expression.
   */
  private extractStringValue(expr: ts.Expression): string | null {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return expr.text;
    }
    return null;
  }

  /**
   * Extracts prompt value from an expression, handling strings, template strings, and variables.
   * For template expressions with variables, extracts the static parts for better estimation.
   */
  private extractPromptValue(
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
      // Extract static parts from template expression
      let staticParts = expr.head.text;
      for (const span of expr.templateSpans) {
        staticParts += span.literal.text;
      }
      // Only return static parts if they're non-empty, otherwise return null
      return { value: staticParts.length > 0 ? staticParts : null, isApproximate: true };
    }

    if (ts.isIdentifier(expr)) {
      return { value: null, isApproximate: true };
    }

    return { value: null, isApproximate: true };
  }

  /**
   * Extracts prompt from all messages' content properties in a messages array.
   */
  private extractMessagesValue(
    expr: ts.Expression,
    sourceFile: ts.SourceFile
  ): { prompt: string | null; isApproximate: boolean } {
    if (!ts.isArrayLiteralExpression(expr)) {
      return { prompt: null, isApproximate: true };
    }

    if (expr.elements.length === 0) {
      return { prompt: null, isApproximate: true };
    }

    const messageContents: string[] = [];
    let isApproximate = false;

    // Iterate through all messages in the array
    for (const messageElement of expr.elements) {
      if (!ts.isObjectLiteralExpression(messageElement)) {
        isApproximate = true;
        continue;
      }

      let foundContent = false;
      for (const prop of messageElement.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
          continue;
        }

        if (prop.name.text === 'content') {
          foundContent = true;
          const result = this.extractPromptValue(prop.initializer, sourceFile);
          if (result.value !== null) {
            messageContents.push(result.value);
          }
          if (result.isApproximate) {
            isApproximate = true;
          }
          break;
        }
      }

      // If no content property found, mark as approximate
      if (!foundContent) {
        isApproximate = true;
      }
    }

    if (messageContents.length === 0) {
      return { prompt: null, isApproximate: true };
    }

    // Concatenate all message contents with newlines
    const combinedPrompt = messageContents.join('\n');
    return { prompt: combinedPrompt, isApproximate };
  }
}

