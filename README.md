<p align="center">
  <img src="assets/logo-512.png" alt="Hambugsy Logo" width="200" />
</p>

<h1 align="center">Hambugsy</h1>

<p align="center">
  <strong>The CLI tool that tells you WHO is wrong: your test or your code.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hambugsy"><img src="https://img.shields.io/npm/v/hambugsy" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/hambugsy"><img src="https://img.shields.io/npm/dm/hambugsy" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/github/gh-copilot"><img src="https://img.shields.io/badge/Built%20with-GitHub%20Copilot%20CLI-blue" alt="Built with GitHub Copilot CLI" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-20.19%2B-green" alt="Node.js 20.19+" /></a>
  <a href="https://github.com/APorkolab/hambugsy"><img src="https://img.shields.io/badge/tests-144%20passing-brightgreen" alt="Tests" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hambugsy"><strong>📦 View on npm</strong></a> •
  <a href="https://hambugsy.dev"><strong>🌐 Website</strong></a> •
  <a href="#installation"><strong>⚡ Quick Start</strong></a>
</p>

---

## Quick Install

```bash
npm install -g hambugsy
hambugsy analyze ./src
```

---

## Demo

[![asciicast](https://asciinema.org/a/hZgtfHSLYVLY2kvL.svg)](https://asciinema.org/a/hZgtfHSLYVLY2kvL)

---

## The Problem

Every developer knows this pain:

```
❌ FAILED: testCalculateDiscount
   Expected: 90
   Actual: 85
```

Now what? Is the test wrong? Is the code wrong? Did someone change the business logic? Is the test outdated?

**You spend 30 minutes investigating only to find the test was written for the OLD discount logic.**

---

## The Solution

```bash
$ hambugsy analyze ./src/OrderService.java

🍔 HAMBUGSY - Test Failure Diagnostics 🍔
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────────────────────────────────────────────────────────┐
│  📍 Method: calculateDiscount() @ line 32                          │
├────────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: testPremiumDiscount                              │
│                                                                    │
│  🔬 ANALYSIS:                                                      │
│  ├── Test expects: 10% discount (written: 2024-03-15)              │
│  └── Code applies: 15% discount (changed: 2024-11-22)              │
│                                                                    │
│  🎯 VERDICT: 📜 OUTDATED TEST (96%)                                │
│                                                                    │
│  💡 RECOMMENDATION:                                                │
│  - assertEquals(90.0, result);                                     │
│  + assertEquals(85.0, result);                                     │
└────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🐛 Code bugs:        0
  📜 Outdated tests:   1
  ✅ Passed:           5

  🚀 Estimated time saved: ~15 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## How It Works

Hambugsy uses **GitHub Copilot CLI** to perform intelligent analysis:

1. **Parse** - Extracts test assertions and code logic
2. **Compare** - Analyzes intent of test vs. implementation
3. **Investigate** - Checks git history for recent changes
4. **Diagnose** - Determines which side diverged from expected behavior
5. **Recommend** - Suggests specific fixes with line numbers

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Test File  │    │  Source Code │    │  Git History │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  GitHub Copilot │
         │       CLI       │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │    VERDICT:     │
         │  Test or Code?  │
         └─────────────────┘
```

---

## Installation

### Prerequisites

#### 1. GitHub CLI (gh)

First, install the GitHub CLI if you haven't already:

```bash
# macOS (Homebrew)
brew install gh

# Windows (winget)
winget install --id GitHub.cli

# Ubuntu/Debian
sudo apt install gh

# Or download from: https://cli.github.com/
```

#### 2. GitHub Copilot CLI Extension

Hambugsy leverages GitHub Copilot CLI for AI-powered analysis. Here's how to set it up:

```bash
# Step 1: Authenticate with GitHub
gh auth login
# Follow the prompts to authenticate via browser or token

# Step 2: Install the Copilot CLI extension
gh extension install github/gh-copilot

# Step 3: Verify installation
gh copilot --help
```

**Requirements for GitHub Copilot CLI:**
- Active GitHub Copilot subscription (Individual, Business, or Enterprise)
- GitHub CLI version 2.0.0 or higher
- Authenticated GitHub session with Copilot access

**Troubleshooting:**
```bash
# If you get permission errors, ensure you're logged in
gh auth status

# If Copilot CLI is not found, try reinstalling
gh extension remove gh-copilot
gh extension install github/gh-copilot

# To upgrade to the latest version
gh extension upgrade gh-copilot
```

> **Note:** Hambugsy works without GitHub Copilot CLI but with limited functionality. The AI-powered semantic analysis and intelligent fix suggestions require Copilot CLI to be installed and authenticated.

---

### Install Hambugsy

```bash
# Option 1: Install globally from npm
npm install -g hambugsy

# Option 2: Clone and build locally
git clone https://github.com/APorkolab/hambugsy.git
cd hambugsy
npm install
npm run build
npm link
```

---

## Usage

### Analyze Command

Analyze test failures and determine if the test or code is buggy.

```bash
# Analyze a specific file
hambugsy analyze ./src/OrderService.java

# Analyze entire directory recursively
hambugsy analyze ./src --recursive

# Filter results
hambugsy analyze ./src --filter=bugs      # Only show code bugs
hambugsy analyze ./src --filter=tests     # Only show outdated tests

# Output formats
hambugsy analyze ./src --format=console   # Pretty terminal output (default)
hambugsy analyze ./src --format=json      # JSON for CI/CD integration
hambugsy analyze ./src --format=github    # GitHub Actions annotations
hambugsy analyze ./src --format=markdown  # Markdown report

# Filter by test name
hambugsy analyze ./src --test=testDiscount  # Only analyze tests matching name

# Interactive mode
hambugsy analyze ./src --interactive      # Confirm each step

# Verbose output
hambugsy analyze ./src --verbose
```

### Suggest Command

Find missing tests and generate test suggestions.

```bash
# Find missing tests in a file/directory
hambugsy suggest ./src/OrderService.java

# Generate test files
hambugsy suggest ./src --generate

# Filter by priority
hambugsy suggest ./src --priority=critical  # Only CRITICAL issues
hambugsy suggest ./src --priority=high      # CRITICAL + HIGH
hambugsy suggest ./src --priority=medium    # All except LOW
```

### Fix Command

Automatically fix detected issues.

```bash
# Auto-fix all detected issues
hambugsy fix ./src

# Dry run - see what would change without modifying files
hambugsy fix ./src --dry-run

# Skip confirmation prompts
hambugsy fix ./src --yes

# Fix only code bugs or only tests
hambugsy fix ./src --filter=bugs   # Only fix code bugs
hambugsy fix ./src --filter=tests  # Only fix outdated tests
```

### Init Command

Initialize Hambugsy configuration in your project.

```bash
hambugsy init
hambugsy init --language=java
hambugsy init --force  # Overwrite existing config
```

---

## Supported Languages

| Language | Test Framework | Status |
|----------|----------------|--------|
| Java | JUnit 4/5, TestNG | ✅ Supported |
| TypeScript/JavaScript | Jest, Vitest, Mocha | ✅ Supported |
| Python | pytest, unittest | ✅ Supported |
| Go | go test, testify | ✅ Supported |
| Rust | #[test], tokio::test | ✅ Supported |
| C# | NUnit, xUnit, MSTest | ✅ Supported |

---

## The Verdict System

Hambugsy classifies every failing test into one of four verdicts:

| Verdict | Meaning | Icon |
|---------|---------|------|
| **Code Bug** | Test is correct, code has a defect | 🐛 |
| **Outdated Test** | Code changed intentionally, test needs update | 📜 |
| **Flaky Test** | Test passes/fails inconsistently | 🎲 |
| **Environment Issue** | External dependency problem | 🌐 |

### How Verdicts Are Determined

```
                    ┌─────────────────────┐
                    │   Divergence Found  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Is code newer than  │
              ┌─YES─┤      the test?      ├─NO──┐
              │     └─────────────────────┘     │
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │ Was the commit  │               │                 │
    │  intentional?   │               │    CODE BUG     │
    │ (feat:, refac:) │               │                 │
    └────────┬────────┘               └─────────────────┘
             │
      ┌──────┴──────┐
      │             │
     YES            NO
      │             │
      ▼             ▼
 ┌─────────┐   ┌─────────┐
 │OUTDATED │   │CODE BUG │
 │  TEST   │   │(regress)│
 └─────────┘   └─────────┘
```

---

## Missing Test Detection

Hambugsy proactively identifies **untested code paths**:

```bash
$ hambugsy suggest ./src/OrderService.java

🍔 HAMBUGSY - Missing Test Suggestions 🍔
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

=== Test Coverage Analysis ===

Total methods:     8
Fully covered:     3
Partially covered: 3
Uncovered:         2

=== Missing Tests ===

📍 validateOrder() @ OrderService.java:42
├── ✅ TESTED: Basic functionality test
├── ❌ MISSING: No test for null input (CRITICAL)
└── ❌ MISSING: No test for empty collection (HIGH)

└── 💡 SUGGESTED TEST:
    @Test
    void testValidateOrder_null_check() {
        OrderService instance = new OrderService();

        assertThrows(NullPointerException.class, () -> {
            instance.validateOrder(null);
        });
    }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MISSING TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔥 CRITICAL:  2
  ⚠️ HIGH:      3
  💡 MEDIUM:    1
  ✅ LOW:       0
```

### Detected Patterns

| Pattern | Description | Priority |
|---------|-------------|----------|
| `NULL_CHECK` | Method has parameter but no null test | CRITICAL |
| `EXCEPTION` | Method can throw but no assertThrows test | CRITICAL |
| `EMPTY_COLLECTION` | Method takes List/Array but no empty test | HIGH |
| `BOUNDARY` | Method has numeric param but no 0/-1/MAX test | MEDIUM |

---

## Configuration

Create `.hambugsy.yml` in your project root:

```yaml
# .hambugsy.yml
language: java
sourceDir: src/main
testDir: src/test
excludePatterns:
  - "**/node_modules/**"
  - "**/build/**"
  - "**/target/**"
outputFormat: console
copilotEnabled: true
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Analysis
on: [push, pull_request]

jobs:
  hambugsy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git analysis

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install GitHub Copilot CLI
        run: gh extension install github/gh-copilot
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Install Hambugsy
        run: npm install -g hambugsy

      - name: Run Analysis
        run: hambugsy analyze ./src --format=github
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Examples

### Example 1: Outdated Test After Business Logic Change

```java
// OrderService.java - Updated 2024-11-22
public double calculateDiscount(double price, boolean isPremium) {
    return isPremium ? price * 0.85 : price * 0.95;  // 15%/5% discount
}

// OrderServiceTest.java - Written 2024-03-15
@Test
void testPremiumDiscount() {
    assertEquals(90.0, service.calculateDiscount(100, true));  // Expects 10%!
}
```

```
🎯 VERDICT: 📜 OUTDATED TEST (96%)

The source code was intentionally updated but the test was not updated to match.
Commit: a1b2c3d - "feat: increase premium discount to 15%"

💡 RECOMMENDATION:
Update the test in OrderServiceTest.java to match the new behavior.
```

### Example 2: Actual Code Bug (Regression)

```java
// UserService.java - Recently changed
public User getUser(String id) {
    User user = db.findById(id);
    return user;  // Missing null check - should throw!
}

// UserServiceTest.java
@Test
void testGetUser_NotFound() {
    assertThrows(UserNotFoundException.class,
        () -> service.getUser("invalid-id"));
}
```

```
🎯 VERDICT: 🐛 CODE BUG (92%)

Regression detected: recent code change broke existing functionality.
Commit: def5678 - "fix: typo in user lookup"

💡 RECOMMENDATION:
Fix the code in UserService.java - add null check and throw UserNotFoundException.
```

### Try It Yourself

Check out the included example project with intentional bugs:

```bash
git clone https://github.com/APorkolab/hambugsy.git
cd hambugsy/examples/buggy-discount-service
hambugsy analyze .
```

This will detect the discount rate mismatch (test expects 10%, code applies 15%).

---

## Why "Hambugsy"?

**Ham** + **Bug** + **Bugsy** (the gangster)

- 🍔 **Ham** - Like a hamburger with layers (test layer, code layer)
- 🐛 **Bug** - What we're hunting
- 🎩 **Bugsy** - Like Bugsy Siegel, we find who's guilty

*"Finding the bug in your stack"* - because bugs hide between layers, just like in a hamburger.

---

## VS Code Extension

Hambugsy comes with a full VS Code extension for seamless integration.

### Installation

```bash
# Build and install the extension
cd vscode-extension
npm install
npm run compile
npm run package
# Then install the .vsix file in VS Code
```

### Features

- **CodeLens Integration** - Inline verdict display directly on test methods
- **Quick Fix Actions** - One-click fixes for detected issues
- **Problems Panel** - Full diagnostic integration with VS Code
- **Results Tree View** - Dedicated sidebar panel for analysis results
- **Context Menu** - Right-click on any test file to analyze
- **Auto-analyze on Save** - Optional real-time analysis
- **Multi-language Support** - Java, TypeScript, JavaScript, Python, Go, Rust, C#
- **Detailed Webview Panel** - Rich HTML view for analysis results

See [vscode-extension/README.md](./vscode-extension/README.md) for full documentation.

---

## Roadmap

- [x] Core verdict engine
- [x] Java/JUnit 5 support
- [x] Git history analysis
- [x] Beautiful console output
- [x] Missing test detection (`suggest` command)
- [x] JSON output format
- [x] GitHub Actions format
- [x] Markdown output format
- [x] TypeScript/Jest/Vitest support
- [x] Python/pytest/unittest support
- [x] Auto-fix mode (`fix` command)
- [x] Interactive mode (`--interactive`)
- [x] Test name filter (`--test`)
- [x] VS Code extension
- [x] Go language support (go test, testify)
- [x] Rust language support (#[test], tokio::test)
- [x] C# language support (NUnit, xUnit, MSTest)
- [x] Real test execution integration
- [x] AST-based code analysis
- [x] Mutation testing for value mismatch detection
- [x] Advanced divergence detection
- [x] VS Code CodeLens and Quick Fix support

---

## Contributing

We welcome contributions!

```bash
# Development setup
git clone https://github.com/APorkolab/hambugsy.git
cd hambugsy
npm install
npm run dev -- --help

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

Built with ❤️ using [GitHub Copilot CLI](https://github.com/github/gh-copilot)

Created for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github) on DEV.to

---

<p align="center">
  <strong>🍔 Stop blaming. Start fixing. 🍔</strong>
</p>
