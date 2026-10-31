# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- `--format json|github|markdown` output was corrupted by the ASCII banner and progress hints on stdout
- `--version` reported 1.0.0 instead of the package version
- Watch mode never re-ran (chokidar no longer supports glob patterns)
- Results were silently dropped when analyzing a directory without git history
- Python and Java method line numbers were off after blank lines; Python bodies could be empty
- `fix` could edit the wrong occurrence of an assertion or every occurrence of a number on the line, and reported success when nothing was applied
- `init` overwrote an existing `.hambugsy.yml` without `--force`
- `suggest --format json -g` left `generatedFiles` empty and appended the file list to the JSON
- GitHub annotations broke on multi-line messages and used absolute paths
- VS Code extension: shell injection through file paths, unescaped HTML in the details view, wrong summary counts and missing suggestions

### Changed
- Upgraded dependencies to their latest majors (commander 15, chalk 6, chokidar 6, execa 10, glob 14, ora 9, p-queue 10, tsup 9, TypeScript 6)
- VS Code extension: ESLint 10 flat config, @vscode/vsce 4, TypeScript 6
- CI: actions/checkout v6, actions/upload-artifact v7, extension lint step

## [1.0.2] - 2026-01-27

### Changed
- Updated all public documentation
- Removed internal documentation from public repository
- Fixed unused variable TypeScript errors

## [1.0.1] - 2026-01-27

### Changed
- Updated author information
- Added npm package links to documentation
- Improved README with new features and badges

## [1.0.0] - 2026-01-27

### Added
- Initial release of Hambugsy CLI
- **Core Features**
  - `analyze` command - Analyze test failures and determine if the test or code is buggy
  - `suggest` command - Find missing tests and generate test suggestions
  - `fix` command - Automatically fix detected issues (tests or code)
  - `init` command - Initialize Hambugsy configuration in the current project

- **Language Support**
  - Java (JUnit 4/5, TestNG)
  - TypeScript/JavaScript (Jest, Vitest, Mocha)
  - Python (pytest, unittest)
  - Go (go test, testify)
  - Rust (#[test], tokio::test)
  - C# (NUnit, xUnit, MSTest)

- **Verdict System**
  - CODE_BUG - Test is correct, code has a defect
  - OUTDATED_TEST - Code changed intentionally, test needs update
  - FLAKY_TEST - Test passes/fails inconsistently
  - ENVIRONMENT_ISSUE - External dependency problem

- **Output Formats**
  - Console (pretty terminal output)
  - JSON (for CI/CD integration)
  - GitHub Actions annotations
  - Markdown report

- **AI-Powered Analysis**
  - GitHub Copilot CLI integration for intelligent analysis
  - Automatic fix suggestions
  - Semantic divergence detection

- **Additional Features**
  - Git history analysis for blame detection
  - Watch mode for continuous analysis
  - Interactive mode for step-by-step analysis
  - Test name filtering
  - Confidence threshold configuration

- **VS Code Extension**
  - CodeLens integration for inline verdict display
  - Quick Fix actions for one-click fixes
  - Problems Panel integration
  - Results Tree View sidebar
  - Context menu integration
  - Auto-analyze on save (optional)

- **CI/CD Support**
  - GitHub Actions workflow example
  - Exit codes for CI integration
  - JSON output for parsing

### Technical
- Built with TypeScript and ESM modules
- Node.js 18+ required
- MIT License
