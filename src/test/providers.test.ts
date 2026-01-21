/**
 * Tests for LLM provider functionality (OpenAI and Claude).
 */

import * as ts from 'typescript';
import { OpenAIProvider } from '../providers/openai';
import { ClaudeProvider } from '../providers/claude';

describe('OpenAI Provider', () => {
  const provider = new OpenAIProvider();

  describe('countTokens', () => {
    it('should count tokens for simple text', () => {
      const tokens = provider.countTokens('Hello world', 'gpt-4');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const tokens = provider.countTokens('', 'gpt-4');
      expect(tokens).toBe(0);
    });

    it('should handle longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens.';
      const tokens = provider.countTokens(text, 'gpt-4');
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('detectApiCalls', () => {
    it('should detect openai.chat.completions.create', () => {
      const code = `
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('openai');
    });

    it('should detect openai.completions.create', () => {
      const code = `
        const response = await openai.completions.create({
          model: 'gpt-3.5-turbo-instruct',
          prompt: 'Hello world'
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('openai');
    });

    it('should extract model from API call', () => {
      const code = `
        await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Test' }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].model).toBe('gpt-4o');
    });

    it('should extract prompt from messages array', () => {
      const code = `
        await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello world' }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toBe('Hello world');
      expect(calls[0].isApproximate).toBe(false);
    });

    it('should extract multiple messages', () => {
      const code = `
        await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'First' },
            { role: 'user', content: 'Second' }
          ]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toContain('First');
      expect(calls[0].prompt).toContain('Second');
      expect(calls[0].messageCount).toBe(2);
    });

    it('should mark template expressions as approximate', () => {
      const code = `
        await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: \`Hello \${name}\` }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].isApproximate).toBe(true);
      expect(calls[0].prompt).toContain('Hello');
    });

    it('should count messages for approximate prompts', () => {
      const code = `
        await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: \`Hello \${name}\` },
            { role: 'user', content: \`Hello \${name}\` },
            { role: 'user', content: \`Hello \${name}\` }
          ]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].messageCount).toBe(3);
    });
  });
});

describe('Claude Provider', () => {
  const provider = new ClaudeProvider();

  describe('countTokens', () => {
    it('should count tokens for simple text', () => {
      const tokens = provider.countTokens('Hello world', 'claude-3-sonnet');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const tokens = provider.countTokens('', 'claude-3-sonnet');
      expect(tokens).toBe(0);
    });
  });

  describe('detectApiCalls', () => {
    it('should detect anthropic.messages.create', () => {
      const code = `
        const response = await anthropic.messages.create({
          model: 'claude-3-sonnet',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('claude');
    });

    it('should extract model from API call', () => {
      const code = `
        await anthropic.messages.create({
          model: 'claude-opus-4.5',
          messages: [{ role: 'user', content: 'Test' }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].model).toBe('claude-opus-4.5');
    });

    it('should extract prompt from messages array', () => {
      const code = `
        await anthropic.messages.create({
          model: 'claude-3-sonnet',
          messages: [{ role: 'user', content: 'Hello world' }]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toBe('Hello world');
    });

    it('should extract multiple messages', () => {
      const code = `
        await anthropic.messages.create({
          model: 'claude-3-sonnet',
          messages: [
            { role: 'user', content: 'First' },
            { role: 'user', content: 'Second' },
            { role: 'user', content: 'Third' }
          ]
        });
      `;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toContain('First');
      expect(calls[0].prompt).toContain('Second');
      expect(calls[0].prompt).toContain('Third');
      expect(calls[0].messageCount).toBe(3);
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
    toBeGreaterThan(value: number) {
      if (actual <= value) {
        throw new Error(`Expected ${actual} to be greater than ${value}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, but got undefined`);
      }
    },
  };
}

