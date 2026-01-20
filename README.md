# TOCO - Token & Cost Estimator

A Visual Studio Code extension that helps developers understand the token usage and estimated cost of GPT API calls directly while writing code.

## Features

- **Static Analysis**: Analyzes JavaScript and TypeScript files without executing code using AST parsing (More languages coming soon)
- **GPT API Detection**: Automatically detects OpenAI GPT API calls (`openai.chat.completions.create()` and `openai.completions.create()`) (More LLM API detections coming soons)
- **Token Estimation**: Accurately estimates token counts using GPT-compatible tokenization
- **Cost Calculation**: Shows estimated costs based on current GPT model pricing (supports 30+ models)
- **Function-Level Estimates**: Aggregates multiple API calls within the same function
- **Token Warnings**: Warns when functions exceed configurable token thresholds
- **Module Resolution**: Resolves imported variables and cross-file dependencies
- **Workspace Hotspots**: Command to find the most expensive functions across your workspace
- **Model-Specific Pricing**: Automatically uses pricing for the model specified in each API call

## How It Works

The extension performs static analysis on your code using TypeScript's compiler API:

- **AST Parsing**: Parses code into an Abstract Syntax Tree for robust analysis
- **Chat Completions**: Detects `openai.chat.completions.create()` calls and extracts messages
- **Legacy Completions**: Detects `openai.completions.create()` calls and extracts prompts
- **Prompt Extraction**: Extracts prompts from string literals, template strings, and variables
- **Variable Resolution**: Resolves variable values from local scope and imported modules
- **Dynamic Prompts**: Marks estimates as approximate when prompts are constructed dynamically

## Usage

1. Open a JavaScript or TypeScript file containing GPT API calls
2. The extension automatically analyzes the code and displays:
   - **File Summary**: Total tokens and cost at the top of the file
   - **Function Estimates**: CodeLens above each function showing tokens/call, cost/call, cost/1k calls, and price per 1M tokens
3. Hover over any CodeLens to see detailed breakdown including:
   - Per-call and per-1000-calls costs
   - Individual API call details
   - Model information
   - Warning messages if token threshold is exceeded

### Commands

- **TOCO: Show Workspace Cost Hotspots**: Find the most expensive functions across your workspace


### Settings

- `toco.defaultModel` (string, default: `"gpt-4o"`): Default model to use for cost estimation when model is not specified in API calls
- `toco.warning.tokenThreshold` (number, default: `2000`): Warn when a function's tokens exceed this threshold (set to `0` to disable warnings)
- `toco.hotspots.topN` (number, default: `10`): Number of most expensive functions to show in workspace hotspots
- `toco.hotspots.maxFiles` (number, default: `500`): Maximum number of files to scan for workspace hotspots

### Supported Models

The extension supports 30+ GPT models including:

**GPT-4 Series**: `gpt-4`, `gpt-4-turbo`, `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`

**GPT-3.5 Series**: `gpt-3.5-turbo`, `gpt-3.5-turbo-instruct`

**GPT-5 Series**: `gpt-5`, `gpt-5.1`, `gpt-5.2`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro`, `gpt-5.2-pro`, `gpt-5-chat-latest`, `gpt-5.1-chat-latest`, `gpt-5.2-chat-latest`, `gpt-5-codex`, `gpt-5.1-codex`, `gpt-5.1-codex-max`, `gpt-5.2-codex`

**O1 Series**: `o1`, `o1-pro`, `o1-mini`

**O3 Series**: `o3`, `o3-pro`, `o3-mini`, `o3-deep-research`

**O4 Series**: `o4-mini`, `o4-mini-deep-research`

If a model is not in the pricing table, the extension will display a "Model not supported" message.

## Features & Limitations

### What's Included

- ✅ JavaScript and TypeScript files (.js, .ts, .jsx, .tsx)
- ✅ Static analysis using AST parsing (no code execution)
- ✅ Input token estimation only
- ✅ String literals, template strings, and variable prompts
- ✅ Cross-file module resolution (imports and requires)
- ✅ Function-level aggregation
- ✅ File-level summaries
- ✅ Token threshold warnings
- ✅ Workspace-wide cost analysis
- ✅ Support for 30+ GPT models with accurate pricing

### Not Included

- ❌ Real usage tracking (runtime call frequency)
- ❌ Output token estimation
- ❌ Support for other programming languages
- ❌ Complex dynamic prompt inference (e.g., function calls that generate prompts)

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Visual Studio Code

### Setup

```bash
npm install
npm run compile
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. Open a JavaScript/TypeScript file with GPT API calls to see the extension in action

### Building

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

## Pricing

The extension includes a comprehensive pricing table with 30+ models. Prices are hardcoded and versioned with the extension for offline use.

### Sample Pricing (per 1M input tokens)

| Model | Price |
|-------|-------|
| gpt-4 | $30.00 |
| gpt-4-turbo | $10.00 |
| gpt-4o | $2.50 |
| gpt-4.1 | $2.00 |
| gpt-3.5-turbo | $0.50 |
| gpt-5 | $1.25 |
| gpt-5.2 | $1.75 |
| o1 | $15.00 |
| o1-pro | $150.00 |
| o3 | $2.00 |

See `src/pricing.ts` for the complete pricing table. Prices are updated as new models are added.

## License

MIT

