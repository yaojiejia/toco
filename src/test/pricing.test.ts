/**
 * Tests for pricing calculations and model pricing lookups.
 */

import { calculateCost, getModelPricing, PRICING_TABLE, formatCost } from '../pricing';

describe('Pricing', () => {
  describe('calculateCost', () => {
    it('should calculate cost for known model', () => {
      // gpt-4o: $2.50 per 1M tokens
      const cost = calculateCost(1000000, 'gpt-4o');
      expect(cost).toBe(2.5);
    });

    it('should calculate cost for partial tokens', () => {
      // gpt-4o: $2.50 per 1M tokens, so 100k tokens = $0.25
      const cost = calculateCost(100000, 'gpt-4o');
      expect(cost).toBe(0.25);
    });

    it('should return 0 for unknown model', () => {
      const cost = calculateCost(1000000, 'unknown-model');
      expect(cost).toBe(0);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost(0, 'gpt-4o');
      expect(cost).toBe(0);
    });

    it('should calculate cost for Claude models', () => {
      // claude-opus-4.5: $5.00 per 1M tokens
      const cost = calculateCost(1000000, 'claude-opus-4.5');
      expect(cost).toBe(5.0);
    });
  });

  describe('getModelPricing', () => {
    it('should return pricing for known model', () => {
      const pricing = getModelPricing('gpt-4o');
      expect(pricing.name).toBe('gpt-4o');
      expect(pricing.pricePerMillionTokens).toBe(2.5);
    });

    it('should return placeholder for unknown model', () => {
      const pricing = getModelPricing('unknown-model');
      expect(pricing.name).toBe('unknown-model');
      expect(pricing.pricePerMillionTokens).toBe(0);
    });

    it('should return pricing for Claude models', () => {
      const pricing = getModelPricing('claude-3-haiku');
      expect(pricing.name).toBe('claude-3-haiku');
      expect(pricing.pricePerMillionTokens).toBe(0.25);
    });
  });

  describe('formatCost', () => {
    it('should format small costs as per 1k', () => {
      const formatted = formatCost(0.001);
      expect(formatted).toContain('/1k');
    });

    it('should format larger costs normally', () => {
      const formatted = formatCost(1.5);
      expect(formatted).toBe('$1.5000');
    });
  });

  describe('PRICING_TABLE', () => {
    it('should contain expected models', () => {
      expect(PRICING_TABLE['gpt-4o']).toBeDefined();
      expect(PRICING_TABLE['gpt-3.5-turbo']).toBeDefined();
      expect(PRICING_TABLE['claude-opus-4.5']).toBeDefined();
      expect(PRICING_TABLE['claude-3-haiku']).toBeDefined();
    });

    it('should have correct pricing for gpt-4o', () => {
      expect(PRICING_TABLE['gpt-4o'].pricePerMillionTokens).toBe(2.5);
    });

    it('should have correct pricing for Claude models', () => {
      expect(PRICING_TABLE['claude-opus-4.5'].pricePerMillionTokens).toBe(5.0);
      expect(PRICING_TABLE['claude-sonnet-4.5'].pricePerMillionTokens).toBe(3.0);
      expect(PRICING_TABLE['claude-haiku-4.5'].pricePerMillionTokens).toBe(1.0);
    });
  });
});

// Simple test runner
function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toContain(substring: string) {
      if (!String(actual).includes(substring)) {
        throw new Error(`Expected "${actual}" to contain "${substring}"`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, but got undefined`);
      }
    },
  };
}

