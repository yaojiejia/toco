/**
 * Module resolution for resolving require/import paths and loading variable definitions from other files.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findVariableDefinitions, VariableDefinition } from './astParser';
import { parseDocument } from './astParser';

/**
 * Resolves a relative module path to an absolute file path.
 */
export function resolveModulePath(
  modulePath: string,
  currentFile: string,
  workspaceRoot?: string
): string | null {
  if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    const currentDir = path.dirname(currentFile);
    const resolvedPath = path.resolve(currentDir, modulePath);

    const extensions = ['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }

    return null;
  }

  return null;
}

/**
 * Loads and parses a module file to extract all variable definitions.
 */
export async function loadModuleVariables(
  modulePath: string,
  currentFile: string,
  workspaceRoot?: string
): Promise<Map<string, VariableDefinition>> {
  const resolvedPath = resolveModulePath(modulePath, currentFile, workspaceRoot);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return new Map();
  }

  try {
    const uri = vscode.Uri.file(resolvedPath);
    const document = await vscode.workspace.openTextDocument(uri);
    const sourceFile = parseDocument(document);
    return findVariableDefinitions(sourceFile, resolvedPath);
  } catch (error) {
    console.error(`Error loading module ${modulePath}:`, error);
    return new Map();
  }
}

/**
 * Resolves a variable value by checking local variables first, then imported modules.
 */
export async function resolveVariableValue(
  varName: string,
  imports: Array<{ name: string; from: string; line: number }>,
  currentFile: string,
  localVariables: Map<string, VariableDefinition>,
  workspaceRoot?: string
): Promise<string | null> {
  const localVar = localVariables.get(varName);
  if (localVar && localVar.value !== null) {
    return localVar.value;
  }

  const importInfo = imports.find(imp => imp.name === varName);
  if (!importInfo) {
    return null;
  }

  const moduleVars = await loadModuleVariables(importInfo.from, currentFile, workspaceRoot);
  const importedVar = moduleVars.get(varName);

  if (importedVar && importedVar.value !== null) {
    return importedVar.value;
  }

  return null;
}
