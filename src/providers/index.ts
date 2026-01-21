/**
 * LLM provider registry and utilities.
 */

import { LLMProvider } from './base';
import { OpenAIProvider } from './openai';
import { ClaudeProvider } from './claude';
import { PythonOpenAIProvider } from './pythonOpenAI';
import { PythonClaudeProvider } from './pythonClaude';

/**
 * Registry of all available LLM providers.
 */
const providers: LLMProvider[] = [
  new OpenAIProvider(),
  new ClaudeProvider(),
  new PythonOpenAIProvider(),
  new PythonClaudeProvider(),
];

/**
 * Gets all registered providers.
 */
export function getAllProviders(): LLMProvider[] {
  return providers;
}

/**
 * Gets a provider by its ID.
 */
export function getProviderById(id: string): LLMProvider | undefined {
  return providers.find(p => p.id === id);
}

/**
 * Registers a new provider (for future extensibility).
 */
export function registerProvider(provider: LLMProvider): void {
  const existing = providers.findIndex(p => p.id === provider.id);
  if (existing >= 0) {
    providers[existing] = provider;
  } else {
    providers.push(provider);
  }
}

