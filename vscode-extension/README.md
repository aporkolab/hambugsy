# Hambugsy VS Code Extension

**The VS Code extension that tells you WHO is wrong: your test or your code.**

## Features

- **Analyze Current File** - Right-click on any Java, TypeScript, JavaScript, or Python file to analyze test failures
- **Analyze Workspace** - Analyze all supported files in your workspace
- **Suggest Missing Tests** - Get suggestions for untested code paths
- **Auto-Fix Issues** - Automatically fix detected issues with one click
- **Inline Diagnostics** - See issues directly in your editor
- **Results Tree View** - Browse all analysis results in the Explorer sidebar

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

- Java (JUnit 4/5)
- TypeScript/JavaScript (Jest, Vitest, Mocha)
- Python (pytest, unittest)

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

### From VS Code Marketplace

Search for "Hambugsy" in the VS Code Extensions view and click Install.

### Manual Installation

1. Download the `.vsix` file from the [releases page](https://github.com/APorkolab/hambugsy/releases)
2. In VS Code, go to Extensions > ... > Install from VSIX
3. Select the downloaded file

## Usage

### Analyzing a File

1. Open a Java, TypeScript, JavaScript, or Python file
2. Right-click in the editor
3. Select "Hambugsy: Analyze Current File"

Or use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "Hambugsy".

### Viewing Results

- **Problems Panel** - Issues appear as errors/warnings in the Problems panel
- **Results Tree** - Browse results in the "Hambugsy Results" view in the Explorer sidebar
- **Output Channel** - Detailed analysis output in the "Hambugsy" output channel

## License

MIT License - see [LICENSE](../LICENSE) for details.
