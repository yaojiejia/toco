/**
 * VS Code extension entry point that provides CodeLens annotations showing token usage and costs above functions.
 */

import * as vscode from 'vscode';
import { analyzeDocument, FunctionEstimate } from './analyzer';
import { formatCost, ModelName, getModelPricing, PRICING_TABLE } from './pricing';

class TocoCodeLensProvider implements vscode.CodeLensProvider {
  public onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  private getTokenThreshold(): number {
    const config = vscode.workspace.getConfiguration('toco');
    return Math.max(0, config.get<number>('warning.tokenThreshold', 2000) ?? 2000);
  }

  /**
   * Provides CodeLens annotations for functions containing GPT API calls.
   */
  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const config = vscode.workspace.getConfiguration('toco');
    const model = (config.get<string>('defaultModel', 'gpt-4') || 'gpt-4') as ModelName;

    try {
      const estimates = await analyzeDocument(document, model);
      const tokenThreshold = this.getTokenThreshold();

      // Add file summary CodeLens at the top of the file
      const fileSummary = this.createFileSummary(estimates, model);
      if (fileSummary) {
        const fileSummaryRange = new vscode.Range(0, 0, 0, 0);
        codeLenses.push(new vscode.CodeLens(fileSummaryRange, {
          title: fileSummary,
          command: '',
          tooltip: this.createFileSummaryTooltip(estimates, model),
        }));
      }

      for (const estimate of estimates) {
        if (estimate.functionName === 'top-level') {
          continue;
        }

        const codeLensLine = Math.max(0, estimate.line - 1);
        const range = new vscode.Range(codeLensLine, 0, codeLensLine, 0);

        // Get the model from the first call (or default model)
        const firstCallModel = estimate.calls.length > 0 ? estimate.calls[0].model : model;
        
        // Check if model is supported
        const isModelSupported = this.isModelSupported(firstCallModel);
        
        if (!isModelSupported) {
          const title = `Model "${firstCallModel}" not supported • Check supported models page`;
          const codeLens = new vscode.CodeLens(range, {
            title,
            command: '',
            tooltip: `Model "${firstCallModel}" is not in our pricing table. Please check the supported models page.`,
          });
          codeLenses.push(codeLens);
          continue;
        }

        const approximateText = estimate.isApproximate ? '~' : '';
        const tokenText = estimate.totalTokens > 1000
          ? `${(estimate.totalTokens / 1000).toFixed(1)}k tokens`
          : `${estimate.totalTokens} tokens`;

        const costPerCall = this.formatPerCallCost(estimate.totalCost);
        const costFor1000 = this.formatCostFor1000(estimate.totalCost * 1000);
        
        const pricePer1M = getModelPricing(firstCallModel).pricePerMillionTokens;
        const pricePer1MText = `$${pricePer1M}/1M tokens`;

        // Check if tokens exceed threshold
        const exceedsThreshold = tokenThreshold > 0 && estimate.totalTokens > tokenThreshold;
        const warnPrefix = exceedsThreshold ? '⚠ ' : '';

        const title = `${warnPrefix}${approximateText}${tokenText}/call • ${costPerCall}/call • ${costFor1000}/1k calls • ${pricePer1MText}`;

        const codeLens = new vscode.CodeLens(range, {
          title,
          command: '',
          tooltip: this.createTooltip(estimate, model, exceedsThreshold, tokenThreshold),
        });

        codeLenses.push(codeLens);
      }
    } catch (error) {
      console.error('TOCO analysis error:', error);
      if (error instanceof Error) {
        console.error('TOCO error stack:', error.stack);
      }
    }

    return codeLenses;
  }

  /**
   * Formats the per-call cost with appropriate precision based on the cost magnitude.
   */
  private formatPerCallCost(cost: number): string {
    if (cost < 0.0001) {
      return `$${cost.toFixed(8)}`;
    } else if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    } else {
      return `$${cost.toFixed(4)}`;
    }
  }

  /**
   * Formats the cost for 1000 calls without the "/1k" suffix that formatCost adds.
   */
  private formatCostFor1000(cost: number): string {
    if (cost < 0.0001) {
      return `$${cost.toFixed(8)}`;
    } else if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    } else if (cost < 1) {
      return `$${cost.toFixed(4)}`;
    } else {
      return `$${cost.toFixed(2)}`;
    }
  }

  /**
   * Checks if a model is supported in our pricing table.
   */
  private isModelSupported(model: ModelName | string): boolean {
    return PRICING_TABLE[model] !== undefined;
  }

  /**
   * Creates a detailed tooltip string showing function estimates and API call breakdown.
   */
  private createTooltip(
    estimate: FunctionEstimate,
    model: ModelName,
    exceedsThreshold: boolean,
    tokenThreshold: number
  ): string {
    const lines: string[] = [];

    lines.push(`Function: ${estimate.functionName}`);
    lines.push(`Model: ${model}`);
    lines.push('');
    lines.push('Per Function Call:');
    lines.push(`  Tokens: ${estimate.totalTokens.toLocaleString()}`);
    lines.push(`  Cost: ${formatCost(estimate.totalCost)}`);
    lines.push('');
    lines.push('For 1000 Calls:');
    lines.push(`  Total tokens: ${(estimate.totalTokens * 1000).toLocaleString()}`);
    lines.push(`  Total cost: ${this.formatCostFor1000(estimate.totalCost * 1000)}/1k calls`);

    if (estimate.isApproximate) {
      lines.push('');
      lines.push('⚠️ Approximate estimate (prompt may be dynamic)');
    }

    if (exceedsThreshold) {
      lines.push('');
      lines.push(`⚠️ High token usage: ${estimate.totalTokens.toLocaleString()} tokens exceeds threshold of ${tokenThreshold.toLocaleString()}`);
    }

    if (estimate.calls.length > 0) {
      lines.push('');
      lines.push(`API calls detected: ${estimate.calls.length}`);
      estimate.calls.forEach((call, index) => {
        if (call.prompt) {
          const preview = call.prompt.substring(0, 50);
          lines.push(`  ${index + 1}. ${call.isApproximate ? '~' : ''}${preview}${call.prompt.length > 50 ? '...' : ''}`);
        } else {
          lines.push(`  ${index + 1}. ${call.isApproximate ? '~' : ''}[Dynamic prompt]`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Creates a file summary CodeLens title showing total tokens and cost for the file.
   */
  private createFileSummary(estimates: FunctionEstimate[], model: ModelName): string | null {
    const validEstimates = estimates.filter(e => e.functionName !== 'top-level');
    if (validEstimates.length === 0) {
      return null;
    }

    let totalTokens = 0;
    let totalCost = 0;
    for (const estimate of validEstimates) {
      totalTokens += estimate.totalTokens;
      totalCost += estimate.totalCost;
    }

    const tokenText = totalTokens > 1000
      ? `${(totalTokens / 1000).toFixed(1)}k tokens`
      : `${totalTokens} tokens`;

    const costText = this.formatPerCallCost(totalCost);
    const costFor1000Text = this.formatCostFor1000(totalCost * 1000);

    return `File: ${tokenText} total • ${costText} total • ${costFor1000Text}/1k calls • ${validEstimates.length} function${validEstimates.length === 1 ? '' : 's'}`;
  }

  /**
   * Creates a detailed tooltip for the file summary CodeLens.
   */
  private createFileSummaryTooltip(estimates: FunctionEstimate[], model: ModelName): string {
    const validEstimates = estimates.filter(e => e.functionName !== 'top-level');
    if (validEstimates.length === 0) {
      return 'No GPT API calls detected in this file';
    }

    let totalTokens = 0;
    let totalCost = 0;
    for (const estimate of validEstimates) {
      totalTokens += estimate.totalTokens;
      totalCost += estimate.totalCost;
    }

    const lines: string[] = [];
    lines.push('File Summary:');
    lines.push(`  Total functions with GPT calls: ${validEstimates.length}`);
    lines.push(`  Total tokens per run: ${totalTokens.toLocaleString()}`);
    lines.push(`  Total cost per run: ${formatCost(totalCost)}`);
    lines.push(`  Total cost for 1000 runs: ${this.formatCostFor1000(totalCost * 1000)}`);
    lines.push('');
    lines.push('Functions:');
    
    // Sort by cost descending
    const sorted = [...validEstimates].sort((a, b) => b.totalCost - a.totalCost);
    sorted.forEach((estimate, index) => {
      lines.push(`  ${index + 1}. ${estimate.functionName} (line ${estimate.line}): ${estimate.totalTokens.toLocaleString()} tokens, ${formatCost(estimate.totalCost)}`);
    });

    return lines.join('\n');
  }

  /**
   * Resolves a CodeLens (currently just returns it unchanged).
   */
  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens;
  }
}

let codeLensProvider: TocoCodeLensProvider | null = null;

/**
 * Activates the extension and registers the CodeLens provider.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('TOCO extension is now active');

  codeLensProvider = new TocoCodeLensProvider();

  const disposable = vscode.languages.registerCodeLensProvider(
    [
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'typescript' },
    ],
    codeLensProvider
  );

  context.subscriptions.push(disposable);

  const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
    if (codeLensProvider) {
      codeLensProvider.onDidChangeCodeLensesEmitter.fire();
    }
  });

  context.subscriptions.push(changeDisposable);

  const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('toco') && codeLensProvider) {
      codeLensProvider.onDidChangeCodeLensesEmitter.fire();
    }
  });

  context.subscriptions.push(configDisposable);

  context.subscriptions.push(
    vscode.commands.registerCommand('toco.showWorkspaceHotspots', async () => {
      const config = vscode.workspace.getConfiguration('toco');
      const model = (config.get<string>('defaultModel', 'gpt-4o') || 'gpt-4o') as ModelName;
      const topN = config.get<number>('hotspots.topN', 10) ?? 10;
      const maxFiles = config.get<number>('hotspots.maxFiles', 500) ?? 500;

      const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', '**/{node_modules,out}/**', maxFiles);
      if (files.length === 0) {
        vscode.window.showInformationMessage('TOCO: No JS/TS files found in workspace.');
        return;
      }

      const items: Array<{
        uri: vscode.Uri;
        estimate: FunctionEstimate;
      }> = [];

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'TOCO: Scanning workspace for hotspots…',
          cancellable: false,
        },
        async (progress) => {
          for (let i = 0; i < files.length; i++) {
            progress.report({ message: `${i + 1}/${files.length}` });
            const doc = await vscode.workspace.openTextDocument(files[i]);
            const estimates = await analyzeDocument(doc, model);
            for (const e of estimates) {
              if (e.functionName === 'top-level') continue;
              items.push({ uri: files[i], estimate: e });
            }
          }
        }
      );

      const hotspots = items
        .sort((a, b) => b.estimate.totalCost - a.estimate.totalCost)
        .slice(0, Math.max(1, Math.min(100, topN)));

      const pick = await vscode.window.showQuickPick(
        hotspots.map((h) => {
          const rel = vscode.workspace.asRelativePath(h.uri);
          return {
            label: `${formatCost(h.estimate.totalCost)} • ${h.estimate.totalTokens} tokens • ${h.estimate.functionName}`,
            description: rel,
            h,
          };
        }),
        {
          title: `TOCO Hotspots (Top ${hotspots.length})`,
          matchOnDescription: true,
        }
      );

      if (!pick) return;

      const doc = await vscode.workspace.openTextDocument(pick.h.uri);
      const editor = await vscode.window.showTextDocument(doc);
      const line = Math.max(0, pick.h.estimate.line - 1);
      const range = new vscode.Range(line, 0, line, 0);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(range.start, range.start);
    })
  );
}

/**
 * Deactivates the extension and cleans up resources.
 */
export function deactivate() {
  codeLensProvider = null;
}
