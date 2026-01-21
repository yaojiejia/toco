/**
 * Tests for Python parser functionality.
 */

import {
  parsePythonFunctions,
  findContainingFunction,
  findFunctionCallsInPythonFunction,
  extractPythonStringValue,
  detectOpenAICalls,
  detectClaudeCalls,
} from '../parsers/pythonParser';

describe('Python Parser', () => {
  describe('parsePythonFunctions', () => {
    it('should detect regular def functions', () => {
      const code = `
def regular_function():
    return "test"
      `;
      const functions = parsePythonFunctions(code);
      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe('regular_function');
    });

    it('should detect async def functions', () => {
      const code = `
async def async_function():
    return "test"
      `;
      const functions = parsePythonFunctions(code);
      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe('async_function');
    });

    it('should detect both async and regular functions', () => {
      const code = `
def regular():
    pass

async def async_func():
    pass
      `;
      const functions = parsePythonFunctions(code);
      expect(functions.length).toBe(2);
      expect(functions.find(f => f.name === 'regular')).toBeDefined();
      expect(functions.find(f => f.name === 'async_func')).toBeDefined();
    });

    it('should handle indented functions', () => {
      const code = `
class MyClass:
    def method(self):
        pass
      `;
      const functions = parsePythonFunctions(code);
      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe('method');
    });
  });

  describe('findContainingFunction', () => {
    it('should find function containing a line number', () => {
      const code = `
def test():
    x = 1
    y = 2
    return x + y
      `;
      const functions = parsePythonFunctions(code);
      const func = findContainingFunction(3, functions);
      expect(func).toBeDefined();
      expect(func!.name).toBe('test');
    });

    it('should return null for line outside any function', () => {
      const code = `
x = 1

def test():
    return x
      `;
      const functions = parsePythonFunctions(code);
      const func = findContainingFunction(2, functions);
      expect(func).toBe(null);
    });
  });

  describe('findFunctionCallsInPythonFunction', () => {
    it('should detect function calls within a function', () => {
      const code = `
def combine_calls():
    api_call()
    api_call()
      `;
      const functions = parsePythonFunctions(code);
      const func = functions.find(f => f.name === 'combine_calls');
      expect(func).toBeDefined();
      
      const calls = findFunctionCallsInPythonFunction(func!, code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('api_call');
      expect(calls[0].count).toBe(2);
    });

    it('should handle await calls', () => {
      const code = `
async def combine_calls():
    await api_call()
    await api_call()
      `;
      const functions = parsePythonFunctions(code);
      const func = functions.find(f => f.name === 'combine_calls');
      expect(func).toBeDefined();
      
      const calls = findFunctionCallsInPythonFunction(func!, code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('api_call');
      expect(calls[0].count).toBe(2);
    });

    it('should not count method calls', () => {
      const code = `
def test():
    obj.method()
    func()
      `;
      const functions = parsePythonFunctions(code);
      const func = functions.find(f => f.name === 'test');
      expect(func).toBeDefined();
      
      const calls = findFunctionCallsInPythonFunction(func!, code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('func');
    });
  });

  describe('extractPythonStringValue', () => {
    it('should extract regular single-quoted strings', () => {
      const result = extractPythonStringValue("'Hello world'");
      expect(result.value).toBe('Hello world');
      expect(result.isApproximate).toBe(false);
    });

    it('should extract regular double-quoted strings', () => {
      const result = extractPythonStringValue('"Hello world"');
      expect(result.value).toBe('Hello world');
      expect(result.isApproximate).toBe(false);
    });

    it('should extract triple-quoted strings', () => {
      const result = extractPythonStringValue('"""Multi\nline\nstring"""');
      expect(result.value).toBe('Multi\nline\nstring');
      expect(result.isApproximate).toBe(false);
    });

    it('should extract static parts from f-strings', () => {
      const result = extractPythonStringValue('f"Hello {name}"');
      expect(result.value).toBe('Hello ');
      expect(result.isApproximate).toBe(true);
    });

    it('should handle f-strings with only variables', () => {
      const result = extractPythonStringValue('f"{name}"');
      expect(result.value).toBe(null);
      expect(result.isApproximate).toBe(true);
    });
  });

  describe('detectOpenAICalls', () => {
    it('should detect openai_client.chat.completions.create', () => {
      const code = `
def test():
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}]
    )
      `;
      const calls = detectOpenAICalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('openai');
      expect(calls[0].callType).toBe('chat');
    });

    it('should extract model from API call', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[]
)
      `;
      const calls = detectOpenAICalls(code);
      expect(calls[0].model).toBe('gpt-4o');
    });

    it('should extract prompt from messages', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello world"}]
)
      `;
      const calls = detectOpenAICalls(code);
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
      const calls = detectOpenAICalls(code);
      expect(calls[0].prompt).toContain('First');
      expect(calls[0].prompt).toContain('Second');
      expect(calls[0].messageCount).toBe(2);
    });

    it('should handle f-strings as approximate', () => {
      const code = `
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": f"Hello {name}"}]
)
      `;
      const calls = detectOpenAICalls(code);
      expect(calls[0].isApproximate).toBe(true);
      expect(calls[0].prompt).toContain('Hello');
    });
  });

  describe('detectClaudeCalls', () => {
    it('should detect anthropic_client.messages.create', () => {
      const code = `
def test():
    response = anthropic_client.messages.create(
        model="claude-3-sonnet",
        messages=[{"role": "user", "content": "Hello"}]
    )
      `;
      const calls = detectClaudeCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].provider).toBe('claude');
      expect(calls[0].callType).toBe('messages');
    });

    it('should extract model from Claude API call', () => {
      const code = `
anthropic_client.messages.create(
    model="claude-opus-4.5",
    messages=[]
)
      `;
      const calls = detectClaudeCalls(code);
      expect(calls[0].model).toBe('claude-opus-4.5');
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
      const calls = detectClaudeCalls(code);
      expect(calls[0].messageCount).toBe(3);
      expect(calls[0].prompt).toContain('First');
      expect(calls[0].prompt).toContain('Second');
      expect(calls[0].prompt).toContain('Third');
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

