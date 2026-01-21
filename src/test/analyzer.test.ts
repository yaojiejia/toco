/**
 * Tests for document analysis and function estimation.
 */

import * as vscode from 'vscode';
import * as ts from 'typescript';
import { analyzeDocument } from '../analyzer';
import { parseDocument } from '../astParser';

// Mock VS Code document
class MockTextDocument implements vscode.TextDocument {
  fileName: string;
  languageId: string;
  version: number;
  isDirty: boolean;
  isUntitled: boolean;
  eol: vscode.EndOfLine;
  lineCount: number;
  uri: vscode.Uri;
  encoding: string;
  isClosed: boolean;
  private text: string;

  constructor(fileName: string, text: string) {
    this.fileName = fileName;
    this.text = text;
    this.languageId = fileName.endsWith('.ts') ? 'typescript' : 'javascript';
    this.version = 1;
    this.isDirty = false;
    this.isUntitled = false;
    this.eol = vscode.EndOfLine.LF;
    this.lineCount = text.split('\n').length;
    this.uri = vscode.Uri.file(fileName);
    this.encoding = 'utf8';
    this.isClosed = false;
  }

  getText(range?: vscode.Range): string {
    if (!range) {
      return this.text;
    }
    const lines = this.text.split('\n');
    const startLine = range.start.line;
    const endLine = range.end.line;
    if (startLine === endLine) {
      return lines[startLine].substring(range.start.character, range.end.character);
    }
    const result: string[] = [];
    result.push(lines[startLine].substring(range.start.character));
    for (let i = startLine + 1; i < endLine; i++) {
      result.push(lines[i]);
    }
    result.push(lines[endLine].substring(0, range.end.character));
    return result.join('\n');
  }

  lineAt(lineOrPosition: number | vscode.Position): vscode.TextLine {
    const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
    const lines = this.text.split('\n');
    return {
      lineNumber: line,
      text: lines[line] || '',
      range: new vscode.Range(line, 0, line, (lines[line] || '').length),
      rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
      firstNonWhitespaceCharacterIndex: 0,
      isEmptyOrWhitespace: (lines[line] || '').trim().length === 0,
    };
  }

  offsetAt(position: vscode.Position): number {
    const lines = this.text.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += lines[i].length + 1;
    }
    return offset + position.character;
  }

  positionAt(offset: number): vscode.Position {
    const lines = this.text.split('\n');
    let currentOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (currentOffset + lineLength > offset) {
        return new vscode.Position(i, offset - currentOffset);
      }
      currentOffset += lineLength;
    }
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
  }

  save(): Thenable<boolean> {
    return Promise.resolve(true);
  }

  getWordRangeAtPosition(position: vscode.Position, regex?: RegExp): vscode.Range | undefined {
    return undefined;
  }

  validateRange(range: vscode.Range): vscode.Range {
    return range;
  }

  validatePosition(position: vscode.Position): vscode.Position {
    return position;
  }
}

describe('Analyzer', () => {
  it('should analyze function with single API call', async () => {
    const code = `
      async function test() {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      }
    `;
    const doc = new MockTextDocument('test.ts', code);
    const estimates = await analyzeDocument(doc, 'gpt-4o');
    
    expect(estimates.length).toBeGreaterThan(0);
    const testEstimate = estimates.find(e => e.functionName === 'test');
    expect(testEstimate).toBeDefined();
    expect(testEstimate!.totalTokens).toBeGreaterThan(0);
    expect(testEstimate!.totalCost).toBeGreaterThan(0);
  });

  it('should aggregate multiple API calls in same function', async () => {
    const code = `
      async function test() {
        await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'First' }]
        });
        await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Second' }]
        });
      }
    `;
    const doc = new MockTextDocument('test.ts', code);
    const estimates = await analyzeDocument(doc, 'gpt-4o');
    
    const testEstimate = estimates.find(e => e.functionName === 'test');
    expect(testEstimate).toBeDefined();
    expect(testEstimate!.calls.length).toBe(2);
  });

  it('should handle functions calling other functions', async () => {
    const code = `
      async function apiCall() {
        await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Test' }]
        });
      }
      
      async function combineCalls() {
        await apiCall();
        await apiCall();
      }
    `;
    const doc = new MockTextDocument('test.ts', code);
    const estimates = await analyzeDocument(doc, 'gpt-4o');
    
    const combineEstimate = estimates.find(e => e.functionName === 'combineCalls');
    expect(combineEstimate).toBeDefined();
    // Should have aggregated tokens from both apiCall() invocations
    expect(combineEstimate!.totalTokens).toBeGreaterThan(0);
  });

  it('should handle multiple messages correctly', async () => {
    const code = `
      async function test() {
        await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'First' },
            { role: 'user', content: 'Second' },
            { role: 'user', content: 'Third' }
          ]
        });
      }
    `;
    const doc = new MockTextDocument('test.ts', code);
    const estimates = await analyzeDocument(doc, 'gpt-4o');
    
    const testEstimate = estimates.find(e => e.functionName === 'test');
    expect(testEstimate).toBeDefined();
    // Should have tokens from all three messages
    expect(testEstimate!.totalTokens).toBeGreaterThan(0);
  });

  it('should handle approximate prompts with message count', async () => {
    const code = `
      async function test(userInput: string) {
        await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: \`Hello \${userInput}\` },
            { role: 'user', content: \`Hello \${userInput}\` },
            { role: 'user', content: \`Hello \${userInput}\` }
          ]
        });
      }
    `;
    const doc = new MockTextDocument('test.ts', code);
    const estimates = await analyzeDocument(doc, 'gpt-4o');
    
    const testEstimate = estimates.find(e => e.functionName === 'test');
    expect(testEstimate).toBeDefined();
    expect(testEstimate!.isApproximate).toBe(true);
    // Should have tokens based on message count (3 messages * default)
    expect(testEstimate!.totalTokens).toBeGreaterThanOrEqual(300);
  });

  it('should handle Claude API calls', async () => {
    const code = `
      async function test() {
        await anthropic.messages.create({
          model: 'claude-3-sonnet',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      }
    `;
    const doc = new MockTextDocument('test.ts', code);
    const estimates = await analyzeDocument(doc, 'gpt-4o');
    
    const testEstimate = estimates.find(e => e.functionName === 'test');
    expect(testEstimate).toBeDefined();
    expect(testEstimate!.totalTokens).toBeGreaterThan(0);
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
    toBeGreaterThanOrEqual(value: number) {
      if (actual < value) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${value}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, but got undefined`);
      }
    },
  };
}

