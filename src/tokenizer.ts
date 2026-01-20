/**
 * Token counting using gpt-tokenizer library to accurately count tokens compatible with OpenAI models.
 */

import { encode } from 'gpt-tokenizer';
import { ModelName } from './pricing';

/**
 * Counts tokens in a text string using GPT-compatible tokenization with fallback estimation.
 */
export function countTokens(text: string, model: ModelName | string = 'gpt-4'): number {
  try {
    const tokens = encode(text);
    return Array.isArray(tokens) ? tokens.length : tokens;
  } catch (error) {
    return Math.ceil(text.length / 4);
  }
}
