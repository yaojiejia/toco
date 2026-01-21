/**
 * Tests for Python provider functionality.
 */

import * as ts from 'typescript';
import { PythonOpenAIProvider } from '../providers/pythonOpenAI';
import { PythonClaudeProvider } from '../providers/pythonClaude';

describe('Python OpenAI Provider', () => {
  const provider = new PythonOpenAIProvider();

  describe('countTokens', () => {
    it('should count tokens for simple text', () => {
      const tokens = provider.countTokens('Hello world', 'gpt-4o');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const tokens = provider.countTokens('', 'gpt-4o');
      expect(tokens).toBe(0);
    });
  });

  describe('detectApiCalls', () => {
    it('should detect openai_client.chat.completions.create', () => {
      const code = `
def test():
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}]
    )
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('python-openai');
    });

    it('should detect client.chat.completions.create with any variable name', () => {
      const code = `
client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Test"}]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls.length).toBe(1);
    });

    it('should extract model from API call', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].model).toBe('gpt-4o');
    });

    it('should extract prompt from messages array', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello world"}]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toBe('Hello world');
      expect(calls[0].isApproximate).toBe(false);
    });

    it('should extract multiple messages', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "First"},
        {"role": "user", "content": "Second"}
    ]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toContain('First');
      expect(calls[0].prompt).toContain('Second');
      expect(calls[0].messageCount).toBe(2);
    });

    it('should mark f-strings as approximate', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": f"Hello {name}"}]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].isApproximate).toBe(true);
    });

    it('should count messages for approximate prompts', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": f"Hello {name}"},
        {"role": "user", "content": f"Hello {name}"},
        {"role": "user", "content": f"Hello {name}"}
    ]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].messageCount).toBe(3);
    });
  });
});

describe('Python Claude Provider', () => {
  const provider = new PythonClaudeProvider();

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
    it('should detect anthropic_client.messages.create', () => {
      const code = `
def test():
    response = anthropic_client.messages.create(
        model="claude-3-sonnet",
        messages=[{"role": "user", "content": "Hello"}]
    )
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('python-claude');
    });

    it('should extract model from API call', () => {
      const code = `
anthropic_client.messages.create(
    model="claude-opus-4.5",
    messages=[]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].model).toBe('claude-opus-4.5');
    });

    it('should extract prompt from messages array', () => {
      const code = `
anthropic_client.messages.create(
    model="claude-3-sonnet",
    messages=[{"role": "user", "content": "Hello world"}]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
      const calls = provider.detectApiCalls(sourceFile);
      expect(calls[0].prompt).toBe('Hello world');
    });

    it('should extract multiple messages', () => {
      const code = `
anthropic_client.messages.create(
    model="claude-3-sonnet",
    messages=[
        {"role": "user", "content": "First"},
        {"role": "user", "content": "Second"},
        {"role": "user", "content": "Third"}
    ]
)
      `;
      const sourceFile = ts.createSourceFile('test.py', code, ts.ScriptTarget.Latest, true);
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

