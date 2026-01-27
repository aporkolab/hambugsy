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
let codeLensProvider: HambugsyCodeLensProvider;
let codeActionProvider: HambugsyCodeActionProvider;

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

  // CodeLens provider for test methods
  codeLensProvider = new HambugsyCodeLensProvider();
  const supportedLanguages = [
    { scheme: "file", language: "java" },
    { scheme: "file", language: "typescript" },
    { scheme: "file", language: "javascript" },
    { scheme: "file", language: "python" },
    { scheme: "file", language: "go" },
    { scheme: "file", language: "rust" },
    { scheme: "file", language: "csharp" },
  ];
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(supportedLanguages, codeLensProvider)
  );

  // Code Action provider for quick fixes
  codeActionProvider = new HambugsyCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(supportedLanguages, codeActionProvider, {
      providedCodeActionKinds: HambugsyCodeActionProvider.providedCodeActionKinds,
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("hambugsy.analyzeFile", analyzeCurrentFile),
    vscode.commands.registerCommand("hambugsy.analyzeWorkspace", analyzeWorkspace),
    vscode.commands.registerCommand("hambugsy.suggestTests", suggestTests),
    vscode.commands.registerCommand("hambugsy.fixIssues", fixIssues),
    vscode.commands.registerCommand("hambugsy.showDetails", showResultDetails),
    vscode.commands.registerCommand("hambugsy.goToSource", goToSource),
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
      "Hambugsy supports Java, TypeScript, JavaScript, Python, Go, Rust, and C# files"
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
  return ["java", "typescript", "javascript", "python", "go", "rust", "csharp"].includes(languageId);
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

// ============================================================================
// Additional Commands
// ============================================================================

async function showResultDetails(result: DiagnosticResult) {
  const panel = vscode.window.createWebviewPanel(
    "hambugsyDetails",
    `Hambugsy: ${result.testName}`,
    vscode.ViewColumn.Two,
    {}
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        h1 { color: var(--vscode-foreground); }
        .verdict {
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          background: var(--vscode-editor-background);
        }
        .CODE_BUG { border-left: 4px solid #f44336; }
        .OUTDATED_TEST { border-left: 4px solid #ff9800; }
        .FLAKY_TEST { border-left: 4px solid #ffeb3b; }
        .PASSED { border-left: 4px solid #4caf50; }
        pre {
          background: var(--vscode-textCodeBlock-background);
          padding: 10px;
          overflow-x: auto;
        }
        .suggestion {
          background: var(--vscode-inputValidation-infoBackground);
          padding: 10px;
          margin: 5px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <h1>${result.testName}</h1>
      <p><strong>File:</strong> ${result.testFile}</p>

      <div class="verdict ${result.verdict.type}">
        <h2>${result.verdict.type}</h2>
        <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(0)}%</p>
        <p><strong>Reason:</strong> ${result.verdict.reason}</p>
        <p>${result.verdict.explanation}</p>
      </div>

      <h3>Recommendation</h3>
      <p>${result.verdict.recommendation.description}</p>

      ${result.verdict.recommendation.suggestedFix ? `
        <h4>Suggested Fix:</h4>
        <pre><code>${result.verdict.recommendation.suggestedFix}</code></pre>
      ` : ""}

      ${result.suggestions.length > 0 ? `
        <h3>Additional Suggestions</h3>
        ${result.suggestions.map(s => `<div class="suggestion">${s}</div>`).join("")}
      ` : ""}
    </body>
    </html>
  `;
}

async function goToSource(filePath: string, lineNumber: number) {
  const doc = await vscode.workspace.openTextDocument(filePath);
  const editor = await vscode.window.showTextDocument(doc);
  const position = new vscode.Position(lineNumber - 1, 0);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

// ============================================================================
// CodeLens Provider - Shows inline verdicts on test methods
// ============================================================================

class HambugsyCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private results: Map<string, DiagnosticResult[]> = new Map();

  setResults(filePath: string, results: DiagnosticResult[]) {
    this.results.set(filePath, results);
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();

    // Find test methods based on language
    const testPatterns = this.getTestPatterns(document.languageId);

    for (const pattern of testPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const position = document.positionAt(match.index);
        const range = new vscode.Range(position, position);

        // Add "Analyze Test" lens
        lenses.push(new vscode.CodeLens(range, {
          title: "$(bug) Analyze with Hambugsy",
          command: "hambugsy.analyzeFile",
          tooltip: "Analyze this test for bugs",
        }));

        // Check if we have a result for this test
        const fileResults = this.results.get(document.uri.fsPath);
        const testName = match[1] || match[2] || match[3];
        const result = fileResults?.find(r => r.testName === testName);

        if (result) {
          const icon = this.getVerdictIcon(result.verdict.type);
          lenses.push(new vscode.CodeLens(range, {
            title: `${icon} ${result.verdict.type} (${(result.confidence * 100).toFixed(0)}%)`,
            command: "hambugsy.showDetails",
            arguments: [result],
            tooltip: result.reasoning,
          }));
        }
      }
    }

    return lenses;
  }

  private getTestPatterns(languageId: string): RegExp[] {
    switch (languageId) {
      case "java":
        return [/@Test[\s\S]*?(?:public\s+)?void\s+(\w+)/g];
      case "typescript":
      case "javascript":
        return [
          /(?:it|test)\s*\(\s*['"]([^'"]+)['"]/g,
          /(?:describe)\s*\(\s*['"]([^'"]+)['"]/g,
        ];
      case "python":
        return [/def\s+(test_\w+)/g];
      case "go":
        return [/func\s+(Test\w+)/g, /func\s+(Benchmark\w+)/g];
      case "rust":
        return [/#\[test\][\s\S]*?fn\s+(\w+)/g, /#\[tokio::test\][\s\S]*?fn\s+(\w+)/g];
      case "csharp":
        return [
          /\[Test\][\s\S]*?(?:public\s+)?(?:async\s+)?(?:void|Task)\s+(\w+)/g,
          /\[Fact\][\s\S]*?(?:public\s+)?(?:async\s+)?(?:void|Task)\s+(\w+)/g,
          /\[TestMethod\][\s\S]*?(?:public\s+)?(?:async\s+)?(?:void|Task)\s+(\w+)/g,
        ];
      default:
        return [];
    }
  }

  private getVerdictIcon(verdictType: string): string {
    switch (verdictType) {
      case "CODE_BUG": return "$(bug)";
      case "OUTDATED_TEST": return "$(history)";
      case "FLAKY_TEST": return "$(question)";
      case "ENVIRONMENT_ISSUE": return "$(globe)";
      case "PASSED": return "$(pass)";
      default: return "$(circle-outline)";
    }
  }
}

// ============================================================================
// Code Action Provider - Quick fixes for detected issues
// ============================================================================

class HambugsyCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Find Hambugsy diagnostics in range
    const hambugsyDiagnostics = context.diagnostics.filter(
      d => d.source === "Hambugsy"
    );

    for (const diagnostic of hambugsyDiagnostics) {
      // Add quick fix action based on verdict type
      if (diagnostic.code === "CODE_BUG") {
        const fixAction = new vscode.CodeAction(
          "View Hambugsy fix suggestion",
          vscode.CodeActionKind.QuickFix
        );
        fixAction.command = {
          command: "hambugsy.fixIssues",
          title: "Apply Hambugsy fix",
        };
        fixAction.diagnostics = [diagnostic];
        fixAction.isPreferred = true;
        actions.push(fixAction);
      }

      if (diagnostic.code === "OUTDATED_TEST") {
        const updateAction = new vscode.CodeAction(
          "Update test to match current code",
          vscode.CodeActionKind.QuickFix
        );
        updateAction.command = {
          command: "hambugsy.suggestTests",
          title: "Suggest updated test",
        };
        updateAction.diagnostics = [diagnostic];
        actions.push(updateAction);
      }

      // Add "Show Details" action for all diagnostics
      const detailsAction = new vscode.CodeAction(
        "Show Hambugsy analysis details",
        vscode.CodeActionKind.Empty
      );
      detailsAction.command = {
        command: "hambugsy.analyzeFile",
        title: "Show details",
      };
      actions.push(detailsAction);
    }

    return actions;
  }
}
