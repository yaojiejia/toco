/**
 * Pricing table for LLM models (input tokens only)
 * Prices are per 1M tokens, as of 2024
 * Version: 2.0 (supports multiple providers)
 */

/**
 * ModelName is kept as a type alias for readability; supported models are determined by PRICING_TABLE keys.
 */
export type ModelName = string;

export interface ModelPricing {
  name: string;
  pricePerMillionTokens: number;
}

export const PRICING_TABLE: Record<string, ModelPricing> = {
  // GPT-4 series

  'gpt-4o': {
    name: 'gpt-4o',
    pricePerMillionTokens: 2.5, // $2.50 per 1M input tokens
  },
  'gpt-4.1': {
    name: 'gpt-4.1',
    pricePerMillionTokens: 2.0, // $2.00 per 1M input tokens
  },
  'gpt-4.1-mini': {
    name: 'gpt-4.1-mini',
    pricePerMillionTokens: 0.4, // $0.40 per 1M input tokens
  },
  'gpt-4.1-nano': {
    name: 'gpt-4.1-nano',
    pricePerMillionTokens: 0.1, // $0.10 per 1M input tokens
  },
  // GPT-3.5 series
  'gpt-3.5-turbo': {
    name: 'gpt-3.5-turbo',
    pricePerMillionTokens: 0.5, // $0.50 per 1M input tokens
  },
  'gpt-3.5-turbo-instruct': {
    name: 'gpt-3.5-turbo-instruct',
    pricePerMillionTokens: 0.5, // $0.50 per 1M input tokens
  },
  // GPT-5 series
  'gpt-5': {
    name: 'gpt-5',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.1': {
    name: 'gpt-5.1',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.2': {
    name: 'gpt-5.2',
    pricePerMillionTokens: 1.75, // $1.75 per 1M input tokens
  },
  'gpt-5-mini': {
    name: 'gpt-5-mini',
    pricePerMillionTokens: 0.25, // $0.25 per 1M input tokens
  },
  'gpt-5-nano': {
    name: 'gpt-5-nano',
    pricePerMillionTokens: 0.05, // $0.05 per 1M input tokens
  },
  'gpt-5-pro': {
    name: 'gpt-5-pro',
    pricePerMillionTokens: 15.0, // $15.00 per 1M input tokens
  },
  'gpt-5.2-pro': {
    name: 'gpt-5.2-pro',
    pricePerMillionTokens: 21.0, // $21.00 per 1M input tokens
  },
  // GPT-5 Chat series
  'gpt-5-chat-latest': {
    name: 'gpt-5-chat-latest',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.1-chat-latest': {
    name: 'gpt-5.1-chat-latest',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.2-chat-latest': {
    name: 'gpt-5.2-chat-latest',
    pricePerMillionTokens: 1.75, // $1.75 per 1M input tokens
  },
  // GPT-5 Codex series
  'gpt-5-codex': {
    name: 'gpt-5-codex',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.1-codex': {
    name: 'gpt-5.1-codex',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.1-codex-max': {
    name: 'gpt-5.1-codex-max',
    pricePerMillionTokens: 1.25, // $1.25 per 1M input tokens
  },
  'gpt-5.2-codex': {
    name: 'gpt-5.2-codex',
    pricePerMillionTokens: 1.75, // $1.75 per 1M input tokens
  },
  // O1 series
  'o1': {
    name: 'o1',
    pricePerMillionTokens: 15.0, // $15.00 per 1M input tokens
  },
  'o1-pro': {
    name: 'o1-pro',
    pricePerMillionTokens: 150.0, // $150.00 per 1M input tokens
  },
  'o1-mini': {
    name: 'o1-mini',
    pricePerMillionTokens: 1.1, // $1.10 per 1M input tokens
  },
  // O3 series
  'o3': {
    name: 'o3',
    pricePerMillionTokens: 2.0, // $2.00 per 1M input tokens
  },
  'o3-pro': {
    name: 'o3-pro',
    pricePerMillionTokens: 20.0, // $20.00 per 1M input tokens
  },
  'o3-mini': {
    name: 'o3-mini',
    pricePerMillionTokens: 1.1, // $1.10 per 1M input tokens
  },
  'o3-deep-research': {
    name: 'o3-deep-research',
    pricePerMillionTokens: 10.0, // $10.00 per 1M input tokens
  },
  // O4 series
  'o4-mini': {
    name: 'o4-mini',
    pricePerMillionTokens: 1.1, // $1.10 per 1M input tokens
  },
  'o4-mini-deep-research': {
    name: 'o4-mini-deep-research',
    pricePerMillionTokens: 2.0, // $2.00 per 1M input tokens
  },
  // Anthropic Claude series
  // Opus series
  'claude-opus-4.5': {
    name: 'claude-opus-4.5',
    pricePerMillionTokens: 5.0, // $5.00 per 1M input tokens
  },
  'claude-opus-4.1': {
    name: 'claude-opus-4.1',
    pricePerMillionTokens: 15.0, // $15.00 per 1M input tokens
  },
  'claude-opus-4': {
    name: 'claude-opus-4',
    pricePerMillionTokens: 15.0, // $15.00 per 1M input tokens
  },
  'claude-3-opus': {
    name: 'claude-3-opus',
    pricePerMillionTokens: 15.0, // $15.00 per 1M input tokens (deprecated)
  },
  // Sonnet series
  'claude-sonnet-4.5': {
    name: 'claude-sonnet-4.5',
    pricePerMillionTokens: 3.0, // $3.00 per 1M input tokens
  },
  'claude-sonnet-4': {
    name: 'claude-sonnet-4',
    pricePerMillionTokens: 3.0, // $3.00 per 1M input tokens
  },
  'claude-3-5-sonnet': {
    name: 'claude-3-5-sonnet',
    pricePerMillionTokens: 3.0, // $3.00 per 1M input tokens
  },
  'claude-3-sonnet': {
    name: 'claude-3-sonnet',
    pricePerMillionTokens: 3.0, // $3.00 per 1M input tokens (deprecated, Sonnet 3.7)
  },
  // Haiku series
  'claude-haiku-4.5': {
    name: 'claude-haiku-4.5',
    pricePerMillionTokens: 1.0, // $1.00 per 1M input tokens
  },
  'claude-3-5-haiku': {
    name: 'claude-3-5-haiku',
    pricePerMillionTokens: 0.8, // $0.80 per 1M input tokens
  },
  'claude-3-haiku': {
    name: 'claude-3-haiku',
    pricePerMillionTokens: 0.25, // $0.25 per 1M input tokens
  },
};

/**
 * Calculate the cost for a given number of tokens
 */
export function calculateCost(tokens: number, model: ModelName | string): number {
  const pricing = PRICING_TABLE[model];
  if (!pricing) {
    // If the model is not in the pricing table, treat cost as 0 to avoid runtime errors.
    return 0;
  }
  return (tokens / 1_000_000) * pricing.pricePerMillionTokens;
}

/**
 * Get pricing information for a model
 */
export function getModelPricing(model: ModelName | string): ModelPricing {
  const pricing = PRICING_TABLE[model];
  if (pricing) {
    return pricing;
  }
  // For unknown models, return a placeholder with 0 pricing.
  return { name: String(model), pricePerMillionTokens: 0 };
}

/**
 * Format cost as a dollar amount string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}/1k`;
  }
  return `$${cost.toFixed(4)}`;
}
