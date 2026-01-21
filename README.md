<h1 align="center">TOCO - Token & Cost Estimator</h1>

<p align="center">
  <strong>💰 Understand LLM API costs before you deploy. Get instant token usage and cost estimates directly in your editor.</strong>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#usage-examples">Examples</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.74+-007ACC?style=flat&logo=visual-studio-code" alt="VS Code Version"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"/>
  <img src="https://img.shields.io/badge/LLM-OpenAI%20%7C%20Claude-412991?style=flat" alt="LLM Support"/>
</p>

---

## What Problem Does This Solve?

When building applications with LLM APIs (OpenAI, Claude, etc.), it's easy to accidentally create expensive prompts without realizing it. By the time you discover the cost in production, it's too late. TOCO provides **early visibility** into token usage and costs during development, helping you make informed decisions about prompt design and API usage before deployment.

## Installation

### Prerequisites

- Visual Studio Code 1.60.0 or higher
- Node.js 18+ (for development)

### Install from VS Code Marketplace

1. Open Visual Studio Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
3. Search for "TOCO" or "Token & Cost Estimator"
4. Click **Install**

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/toco.git
   cd toco
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run compile
   ```

4. Press `F5` in VS Code to launch a new Extension Development Host window

## Quick Start {#quick-start}

Once installed, TOCO automatically analyzes your code and displays cost estimates. Here's what you'll see:

### Example: JavaScript/TypeScript

```typescript
async function generateSummary(text: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: `Summarize this text: ${text}` }
    ]
  });
  return response;
}
```

**CodeLens above the function:**
```
📊 ~15 tokens/call • $0.00004/call • $0.04/1k calls • $2.50/1M tokens
```

### Example: Python

```python
def analyze_sentiment(text: str):
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": f"Analyze sentiment: {text}"}
        ]
    )
    return response
```

**CodeLens above the function:**
```
📊 ~15 tokens/call • $0.00004/call • $0.04/1k calls • $2.50/1M tokens
```

## Features {#features}

### 🎯 Multi-Language Support

- **JavaScript & TypeScript**: Full AST-based analysis with module resolution
- **Python**: Support for OpenAI and Claude Python SDKs

### 🔍 Smart Detection

- **OpenAI API**: Detects `openai.chat.completions.create()` and `openai.completions.create()`
- **Claude API**: Detects `anthropic.messages.create()`
- **Client Instances**: Works with any variable name (e.g., `client.chat.completions.create()`)

### 💰 Accurate Cost Estimation

- **30+ Models Supported**: GPT-4, GPT-3.5, GPT-5 series, O1/O3/O4 series, Claude models
- **Real-Time Pricing**: Uses up-to-date pricing tables for all supported models
- **Model-Specific Costs**: Automatically uses the pricing for the model specified in each API call

### 📊 Function-Level Analysis

- **Aggregated Estimates**: Sums multiple API calls within the same function
- **Call Graph Tracking**: Shows accumulated costs for functions that call other LLM functions
- **File Summaries**: See total tokens and cost for the entire file

### ⚠️ Smart Warnings

- **Token Thresholds**: Get warned when functions exceed configurable token limits
- **Unsupported Models**: Clear messaging when a model isn't in the pricing table

### 🔧 Advanced Features

- **Static Analysis**: No code execution required - works entirely through static analysis
- **Variable Resolution**: Resolves prompts from imported modules and local variables
- **Dynamic Prompts**: Marks estimates as approximate when prompts are constructed dynamically
- **Multiple Messages**: Accurately counts tokens for multi-message conversations

## Configuration {#configuration}

Configure TOCO through VS Code settings (`Ctrl+,` or `Cmd+,`):

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `toco.defaultModel` | string | `"gpt-4o"` | Default model for cost estimation when model is not specified |
| `toco.warning.tokenThreshold` | number | `2000` | Warn when a function's tokens exceed this threshold (set to `0` to disable) |
| `toco.hotspots.topN` | number | `10` | Number of most expensive functions to show in workspace hotspots |
| `toco.hotspots.maxFiles` | number | `500` | Maximum number of files to scan for workspace hotspots |

### Example Settings

```json
{
  "toco.defaultModel": "gpt-4o",
  "toco.warning.tokenThreshold": 1000,
  "toco.hotspots.topN": 20
}
```

## Usage Examples {#usage-examples}

### Basic Usage

Simply open a file containing LLM API calls. TOCO automatically analyzes and displays estimates:

```typescript
// File summary appears at the top
// Function estimates appear above each function

async function simpleCall() {
  await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }]
  });
}
```

### Multiple API Calls

TOCO aggregates multiple calls within the same function:

```typescript
async function complexFunction() {
  await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'First call' }]
  });
  
  await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Second call' }]
  });
}
// Shows combined token count and cost
```

### Function Call Tracking

TOCO tracks functions that call other functions:

```typescript
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
// combineCalls() shows 2x the cost of apiCall()
```

### Workspace Hotspots

Find the most expensive functions across your workspace:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "TOCO: Show Workspace Cost Hotspots"
3. See a ranked list of functions by cost

## Supported Models

### OpenAI Models

**GPT-4 Series**: `gpt-4`, `gpt-4-turbo`, `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`

**GPT-3.5 Series**: `gpt-3.5-turbo`, `gpt-3.5-turbo-instruct`

**GPT-5 Series**: `gpt-5`, `gpt-5.1`, `gpt-5.2`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro`, `gpt-5.2-pro`, `gpt-5-chat-latest`, `gpt-5.1-chat-latest`, `gpt-5.2-chat-latest`, `gpt-5-codex`, `gpt-5.1-codex`, `gpt-5.1-codex-max`, `gpt-5.2-codex`

**O1 Series**: `o1`, `o1-pro`, `o1-mini`

**O3 Series**: `o3`, `o3-pro`, `o3-mini`, `o3-deep-research`

**O4 Series**: `o4-mini`, `o4-mini-deep-research`

### Claude Models

**Claude 3 Series**: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`, `claude-3-5-sonnet`, `claude-3-5-haiku`

**Claude 4 Series**: `claude-opus-4`, `claude-opus-4.1`, `claude-opus-4.5`, `claude-sonnet-4`, `claude-sonnet-4.5`, `claude-haiku-4.5`

If a model is not in the pricing table, TOCO will display "Model 'model-name' not supported" instead of falling back to a default.

## How It Works {#how-it-works}

TOCO performs **static analysis** on your code without executing it:

1. **AST Parsing**: Parses code into an Abstract Syntax Tree for robust analysis
2. **API Detection**: Identifies LLM API calls using pattern matching and AST traversal
3. **Prompt Extraction**: Extracts prompts from string literals, template strings, and variables
4. **Variable Resolution**: Resolves variable values from local scope and imported modules
5. **Token Counting**: Uses GPT-compatible tokenization for OpenAI, character-based estimation for Claude
6. **Cost Calculation**: Applies model-specific pricing from the built-in pricing table

### Limitations

- **Input Tokens Only**: Currently estimates input tokens, not output tokens
- **Static Analysis**: Cannot evaluate complex dynamic prompts (marked as approximate)
- **No Runtime Tracking**: Does not track actual API usage or call frequency

## Development {#development}

### Prerequisites

- Node.js 18+
- npm or yarn
- Visual Studio Code

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/toco.git
   cd toco
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile TypeScript:
   ```bash
   npm run compile
   ```

### Running Tests

```bash
npm test
```

This runs unit tests for pricing, providers, and Python parser functionality.

### Building

```bash
npm run compile
```

### Watch Mode (Development)

```bash
npm run watch
```

This watches for file changes and recompiles automatically.

### Project Structure

```
toco/
├── src/
│   ├── extension.ts          # VS Code extension entry point
│   ├── analyzer.ts           # Document analysis logic
│   ├── astParser.ts          # TypeScript AST parsing
│   ├── moduleResolver.ts     # Module resolution for imports
│   ├── pricing.ts            # Pricing table and cost calculations
│   ├── parsers/
│   │   └── pythonParser.ts   # Python code parsing
│   ├── providers/
│   │   ├── base.ts           # LLM provider interface
│   │   ├── openai.ts         # OpenAI provider (JS/TS)
│   │   ├── claude.ts         # Claude provider (JS/TS)
│   │   ├── pythonOpenAI.ts   # OpenAI provider (Python)
│   │   └── pythonClaude.ts  # Claude provider (Python)
│   └── test/                 # Test suite
├── example.ts                # Example TypeScript file
├── example.py                # Example Python file
└── package.json              # Extension manifest
```

## Contributing

Contributions are welcome! Here's how you can help:

### Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/yourusername/toco/issues) with:
- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- VS Code version and OS

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add one-sentence descriptions to files and functions
- Write tests for new features

### Adding New LLM Providers

1. Create a new provider class implementing `LLMProvider` interface
2. Implement `detectApiCalls`, `extractPromptExpression`, `countTokens`, and `countMessages`
3. Register the provider in `src/providers/index.ts`
4. Add tests in `src/test/`

### Adding New Languages

1. Create a parser in `src/parsers/` for the new language
2. Create language-specific providers in `src/providers/`
3. Update `src/analyzer.ts` to handle the new language
4. Register the language in `package.json` activation events
5. Add comprehensive tests

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/) and [VS Code Extension API](https://code.visualstudio.com/api)
- Token counting uses [gpt-tokenizer](https://www.npmjs.com/package/gpt-tokenizer) for OpenAI models
- Python parsing uses regex-based pattern matching (AST parsing coming soon)

## Related Resources

- [VS Code Extension API Documentation](https://code.visualstudio.com/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic Claude API Documentation](https://docs.anthropic.com/)

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/toco/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/toco/discussions)

---

**Made with ❤️ for developers building with LLMs**
