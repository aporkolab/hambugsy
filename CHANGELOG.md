# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
