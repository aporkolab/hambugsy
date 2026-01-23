import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface DiagnosticResult {
  testName: string;
  testFile: string;
  verdict: {
    type: "CODE_BUG" | "OUTDATED_TEST" | "FLAKY_TEST" | "ENVIRONMENT_ISSUE" | "PASSED";
    reason: string;
    confidence: number;
    explanation: string;
    recommendation: {
      description: string;
      suggestedFix?: string;
      affectedFiles: string[];
    };
  };
  confidence: number;
  reasoning: string;
  suggestions: string[];
}

interface AnalysisOutput {
  results: DiagnosticResult[];
  summary: {
    codeBugs: number;
    outdatedTests: number;
    flakyTests: number;
    environmentIssues: number;
    passed: number;
  };
}

// ============================================================================
// Extension Activation
// ============================================================================

let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let resultsProvider: HambugsyResultsProvider;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Hambugsy");
  diagnosticCollection = vscode.languages.createDiagnosticCollection("hambugsy");
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "$(bug) Hambugsy";
  statusBarItem.command = "hambugsy.analyzeWorkspace";
  statusBarItem.show();

  // Results tree view
  resultsProvider = new HambugsyResultsProvider();
  vscode.window.registerTreeDataProvider("hambugsyResults", resultsProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("hambugsy.analyzeFile", analyzeCurrentFile),
    vscode.commands.registerCommand("hambugsy.analyzeWorkspace", analyzeWorkspace),
    vscode.commands.registerCommand("hambugsy.suggestTests", suggestTests),
    vscode.commands.registerCommand("hambugsy.fixIssues", fixIssues),
    diagnosticCollection,
    outputChannel,
    statusBarItem
  );

  // Auto-analyze on save
  const config = vscode.workspace.getConfiguration("hambugsy");
  if (config.get("autoAnalyze")) {
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isSupportedLanguage(document.languageId)) {
        analyzeFile(document.uri.fsPath);
      }
    });
  }

  outputChannel.appendLine("Hambugsy extension activated!");
}

export function deactivate() {
  outputChannel.appendLine("Hambugsy extension deactivated");
}

// ============================================================================
// Commands
// ============================================================================

async function analyzeCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No file open to analyze");
    return;
  }

  if (!isSupportedLanguage(editor.document.languageId)) {
    vscode.window.showWarningMessage(
      "Hambugsy only supports Java, TypeScript, JavaScript, and Python files"
    );
    return;
  }

  await analyzeFile(editor.document.uri.fsPath);
}

async function analyzeWorkspace() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("No workspace folder open");
    return;
  }

  const folder = workspaceFolders[0].uri.fsPath;
  await analyzeFile(folder);
}

async function suggestTests() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No file open to analyze");
    return;
  }

  const filePath = editor.document.uri.fsPath;

  statusBarItem.text = "$(sync~spin) Analyzing...";

  try {
    const { stdout } = await execAsync(`npx hambugsy suggest "${filePath}" --format=json`);
    const output = JSON.parse(stdout);

    outputChannel.clear();
    outputChannel.appendLine("=== Missing Test Suggestions ===\n");

    for (const suggestion of output.suggestions || []) {
      outputChannel.appendLine(`${suggestion.priority} - ${suggestion.methodName}`);
      outputChannel.appendLine(`  File: ${suggestion.filePath}:${suggestion.lineNumber}`);
      outputChannel.appendLine(`  Rationale: ${suggestion.rationale}`);
      if (suggestion.suggestedTest) {
        outputChannel.appendLine(`  Suggested Test:\n${suggestion.suggestedTest}`);
      }
      outputChannel.appendLine("");
    }

    outputChannel.show();
    vscode.window.showInformationMessage(
      `Hambugsy found ${output.suggestions?.length || 0} missing test suggestions`
    );
  } catch (error) {
    handleError(error);
  } finally {
    statusBarItem.text = "$(bug) Hambugsy";
  }
}

async function fixIssues() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("No workspace folder open");
    return;
  }

  const folder = workspaceFolders[0].uri.fsPath;

  // Show what would be fixed first (dry run)
  statusBarItem.text = "$(sync~spin) Checking fixes...";

  try {
    const { stdout } = await execAsync(`npx hambugsy fix "${folder}" --dry-run`);

    const result = await vscode.window.showInformationMessage(
      "Hambugsy found fixable issues. Apply fixes?",
      { modal: true, detail: stdout },
      "Apply Fixes",
      "Cancel"
    );

    if (result === "Apply Fixes") {
      statusBarItem.text = "$(sync~spin) Applying fixes...";
      await execAsync(`npx hambugsy fix "${folder}" --yes`);
      vscode.window.showInformationMessage("Fixes applied successfully!");
    }
  } catch (error) {
    handleError(error);
  } finally {
    statusBarItem.text = "$(bug) Hambugsy";
  }
}

// ============================================================================
// Analysis
// ============================================================================

async function analyzeFile(filePath: string) {
  statusBarItem.text = "$(sync~spin) Analyzing...";
  outputChannel.clear();
  outputChannel.appendLine(`Analyzing: ${filePath}\n`);

  try {
    const { stdout } = await execAsync(`npx hambugsy analyze "${filePath}" --format=json`);
    const output: AnalysisOutput = JSON.parse(stdout);

    // Clear previous diagnostics
    diagnosticCollection.clear();

    // Process results
    const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

    for (const result of output.results) {
      const uri = vscode.Uri.file(result.testFile);
      const diagnostics = diagnosticsMap.get(result.testFile) || [];

      const severity = getSeverity(result.verdict.type);
      const range = new vscode.Range(0, 0, 0, 100); // Would need line info

      const diagnostic = new vscode.Diagnostic(
        range,
        `[${result.verdict.type}] ${result.reasoning}`,
        severity
      );
      diagnostic.source = "Hambugsy";
      diagnostic.code = result.verdict.type;

      diagnostics.push(diagnostic);
      diagnosticsMap.set(result.testFile, diagnostics);
    }

    // Apply diagnostics
    for (const [file, diagnostics] of diagnosticsMap) {
      diagnosticCollection.set(vscode.Uri.file(file), diagnostics);
    }

    // Update results view
    resultsProvider.setResults(output.results);

    // Show summary
    const { summary } = output;
    outputChannel.appendLine("=== Analysis Summary ===");
    outputChannel.appendLine(`Code Bugs: ${summary.codeBugs}`);
    outputChannel.appendLine(`Outdated Tests: ${summary.outdatedTests}`);
    outputChannel.appendLine(`Flaky Tests: ${summary.flakyTests}`);
    outputChannel.appendLine(`Environment Issues: ${summary.environmentIssues}`);
    outputChannel.appendLine(`Passed: ${summary.passed}`);
    outputChannel.show();

    const total = output.results.length;
    const issues = summary.codeBugs + summary.outdatedTests;
    vscode.window.showInformationMessage(
      `Hambugsy: ${issues} issue(s) found in ${total} test(s)`
    );
  } catch (error) {
    handleError(error);
  } finally {
    statusBarItem.text = "$(bug) Hambugsy";
  }
}

// ============================================================================
// Results Tree View
// ============================================================================

class HambugsyResultsProvider implements vscode.TreeDataProvider<ResultItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ResultItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private results: DiagnosticResult[] = [];

  setResults(results: DiagnosticResult[]) {
    this.results = results;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ResultItem): ResultItem[] {
    if (!element) {
      return this.results.map(
        (r) =>
          new ResultItem(
            r.testName,
            r.verdict.type,
            r.testFile,
            vscode.TreeItemCollapsibleState.None
          )
      );
    }
    return [];
  }
}

class ResultItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly verdictType: string,
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    this.tooltip = `${verdictType}: ${filePath}`;
    this.description = verdictType;
    this.iconPath = this.getIcon();

    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [vscode.Uri.file(filePath)],
    };
  }

  private getIcon(): vscode.ThemeIcon {
    switch (this.verdictType) {
      case "CODE_BUG":
        return new vscode.ThemeIcon("bug", new vscode.ThemeColor("errorForeground"));
      case "OUTDATED_TEST":
        return new vscode.ThemeIcon("history", new vscode.ThemeColor("warningForeground"));
      case "FLAKY_TEST":
        return new vscode.ThemeIcon("question", new vscode.ThemeColor("warningForeground"));
      case "ENVIRONMENT_ISSUE":
        return new vscode.ThemeIcon("globe", new vscode.ThemeColor("warningForeground"));
      case "PASSED":
        return new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
      default:
        return new vscode.ThemeIcon("circle-outline");
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function isSupportedLanguage(languageId: string): boolean {
  return ["java", "typescript", "javascript", "python"].includes(languageId);
}

function getSeverity(verdictType: string): vscode.DiagnosticSeverity {
  switch (verdictType) {
    case "CODE_BUG":
      return vscode.DiagnosticSeverity.Error;
    case "OUTDATED_TEST":
    case "FLAKY_TEST":
      return vscode.DiagnosticSeverity.Warning;
    case "ENVIRONMENT_ISSUE":
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  outputChannel.appendLine(`Error: ${message}`);
  vscode.window.showErrorMessage(`Hambugsy: ${message}`);
}
