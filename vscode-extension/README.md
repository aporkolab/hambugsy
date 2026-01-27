# Hambugsy VS Code Extension

**The VS Code extension that tells you WHO is wrong: your test or your code.**

[![npm version](https://img.shields.io/npm/v/hambugsy)](https://www.npmjs.com/package/hambugsy)

## Features

- **CodeLens Integration** - See verdicts directly on test methods in your editor
- **Quick Fix Actions** - One-click fixes for detected issues
- **Analyze Current File** - Right-click on any supported file to analyze test failures
- **Analyze Workspace** - Analyze all supported files in your workspace
- **Suggest Missing Tests** - Get suggestions for untested code paths
- **Auto-Fix Issues** - Automatically fix detected issues with one click
- **Inline Diagnostics** - See issues directly in your editor
- **Results Tree View** - Browse all analysis results in the Explorer sidebar
- **Detailed Webview Panel** - Rich HTML view for detailed analysis results

## Commands

| Command | Description |
|---------|-------------|
| `Hambugsy: Analyze Current File` | Analyze the currently open file |
| `Hambugsy: Analyze Workspace` | Analyze all files in the workspace |
| `Hambugsy: Suggest Missing Tests` | Find missing tests for the current file |
| `Hambugsy: Fix Issues` | Auto-fix detected issues |

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `hambugsy.autoAnalyze` | Automatically analyze files on save | `false` |
| `hambugsy.confidenceThreshold` | Minimum confidence threshold for results | `0.5` |
| `hambugsy.showInlineHints` | Show inline hints for detected issues | `true` |

## Supported Languages

| Language | Test Framework |
|----------|----------------|
| Java | JUnit 4/5, TestNG |
| TypeScript/JavaScript | Jest, Vitest, Mocha |
| Python | pytest, unittest |
| Go | go test, testify |
| Rust | #[test], tokio::test |
| C# | NUnit, xUnit, MSTest |

## Prerequisites

1. Install the Hambugsy CLI globally:
   ```bash
   npm install -g hambugsy
   ```

2. Install GitHub Copilot CLI for AI-powered analysis:
   ```bash
   gh extension install github/gh-copilot
   ```

## Installation

### Manual Installation

1. Build the extension:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npm run package
   ```

2. In VS Code, go to Extensions > ... > Install from VSIX

3. Select the generated `.vsix` file

## Usage

### Analyzing a File

1. Open any supported file (Java, TypeScript, JavaScript, Python, Go, Rust, C#)
2. Right-click in the editor
3. Select "Hambugsy: Analyze Current File"

Or use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "Hambugsy".

### CodeLens

When you open a test file, you'll see CodeLens annotations above each test method:
- `$(bug) Analyze with Hambugsy` - Click to analyze the test
- `$(bug) CODE_BUG (85%)` - Shows the verdict if already analyzed

### Viewing Results

- **Problems Panel** - Issues appear as errors/warnings in the Problems panel
- **Results Tree** - Browse results in the "Hambugsy Results" view in the Explorer sidebar
- **Output Channel** - Detailed analysis output in the "Hambugsy" output channel
- **Webview Panel** - Click on a result to see detailed analysis in a rich HTML view

## Links

- **npm:** https://www.npmjs.com/package/hambugsy
- **GitHub:** https://github.com/APorkolab/hambugsy
- **Website:** https://hambugsy.dev

## License

MIT License - see [LICENSE](../LICENSE) for details.
