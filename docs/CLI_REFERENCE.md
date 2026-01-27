# Hambugsy CLI Reference

> **Version:** 1.0.2 | **npm:** [npmjs.com/package/hambugsy](https://www.npmjs.com/package/hambugsy)

## Command Overview

```
hambugsy <command> [options] [arguments]

Commands:
  analyze     Analyze source files for test/code issues
  suggest     Find missing tests and generate suggestions
  fix         Auto-fix issues with confirmation
  report      Generate detailed report
  init        Initialize configuration file
  version     Show version information
  help        Show help for a command
```

## Supported Languages

| Language | Test Frameworks |
|----------|-----------------|
| Java | JUnit 4/5, TestNG |
| TypeScript/JavaScript | Jest, Vitest, Mocha |
| Python | pytest, unittest |
| Go | go test, testify |
| Rust | #[test], tokio::test |
| C# | NUnit, xUnit, MSTest |

---

## Global Options

These options apply to all commands:

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to config file (default: `.hambugsy.yml`) |
| `--verbose`, `-v` | Enable verbose output |
| `--quiet`, `-q` | Suppress non-essential output |
| `--no-color` | Disable colored output |
| `--json` | Output results as JSON |
| `--help`, `-h` | Show help |
| `--version`, `-V` | Show version |

---

## analyze

Analyze source files and determine verdicts for failing tests.

### Synopsis

```bash
hambugsy analyze <path> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `path` | File or directory to analyze (required) |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--recursive`, `-r` | boolean | false | Analyze directories recursively |
| `--filter <type>` | string | "all" | Filter results: `bugs`, `tests`, `flaky`, `env`, `all` |
| `--test <name>` | string | - | Analyze specific test by name |
| `--format <fmt>` | string | "console" | Output format (see below) |
| `--confidence <n>` | number | 0.7 | Minimum confidence threshold (0.0-1.0) |
| `--since <date>` | string | - | Only analyze changes since date |
| `--parallel <n>` | number | 4 | Number of parallel analyses |
| `--no-git` | boolean | false | Skip git history analysis |
| `--no-cache` | boolean | false | Disable caching |

### Output Formats

| Format | Description |
|--------|-------------|
| `console` | Human-readable terminal output (default) |
| `json` | Machine-readable JSON |
| `markdown` | Markdown report |
| `github` | GitHub Actions annotations |
| `gitlab` | GitLab CI report format |
| `junit` | JUnit XML format |

### Examples

```bash
# Analyze a single file
hambugsy analyze ./src/OrderService.java

# Analyze directory recursively
hambugsy analyze ./src -r

# Only show code bugs
hambugsy analyze ./src --filter=bugs

# Analyze specific test
hambugsy analyze ./src --test="testCalculateDiscount"

# Output as JSON
hambugsy analyze ./src --format=json

# Output GitHub Actions annotations
hambugsy analyze ./src --format=github

# High confidence threshold
hambugsy analyze ./src --confidence=0.9

# Analyze changes since date
hambugsy analyze ./src --since="2024-01-01"

# Verbose output with parallel processing
hambugsy analyze ./src -v --parallel=8

# Pipe JSON to file
hambugsy analyze ./src --format=json > report.json

# Combine with jq
hambugsy analyze ./src --format=json | jq '.results[] | select(.verdict.type == "CODE_BUG")'

# Analyze Go project
hambugsy analyze ./pkg --recursive

# Analyze Rust project
hambugsy analyze ./src --recursive

# Analyze C# project
hambugsy analyze ./src --recursive
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, no issues found |
| 1 | Success, code bugs found |
| 2 | Configuration error |
| 3 | Parse error |
| 4 | Copilot CLI not available |
| 5 | Git not available |
| 10 | Unknown error |

---

## fix

Automatically apply recommended fixes with confirmation.

### Synopsis

```bash
hambugsy fix <path> [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--yes`, `-y` | boolean | false | Skip confirmation prompts |
| `--dry-run` | boolean | false | Show fixes without applying |
| `--filter <type>` | string | "all" | Filter: `bugs`, `tests`, `all` |
| `--backup` | boolean | true | Create backup files |

### Examples

```bash
# Interactive fix mode
hambugsy fix ./src

# Auto-approve all fixes
hambugsy fix ./src --yes

# Preview fixes without applying
hambugsy fix ./src --dry-run

# Only fix outdated tests
hambugsy fix ./src --filter=tests

# Fix without creating backups
hambugsy fix ./src --no-backup
```

### Interactive Mode

When run without `--yes`, the fix command prompts for each fix:

```
🍔 Found 3 issues to fix

[1/3] OrderServiceTest.java:23
      Verdict: OUTDATED TEST
      Fix: assertEquals(90.0, result) → assertEquals(85.0, result)
      
      Apply this fix? [y/n/a/q] (yes/no/all/quit): 
```

| Input | Action |
|-------|--------|
| `y` | Apply this fix |
| `n` | Skip this fix |
| `a` | Apply all remaining fixes |
| `q` | Quit without applying more |

---

## report

Generate a detailed analysis report.

### Synopsis

```bash
hambugsy report <path> [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--output`, `-o` | string | stdout | Output file path |
| `--format <fmt>` | string | "markdown" | Format: `markdown`, `html`, `pdf` |
| `--include-passed` | boolean | false | Include passing tests |
| `--include-code` | boolean | true | Include code snippets |

### Examples

```bash
# Generate Markdown report
hambugsy report ./src -o report.md

# Generate HTML report
hambugsy report ./src --format=html -o report.html

# Generate PDF report
hambugsy report ./src --format=pdf -o report.pdf

# Include all tests (including passed)
hambugsy report ./src --include-passed -o full-report.md
```

---

## init

Initialize a configuration file.

### Synopsis

```bash
hambugsy init [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--force`, `-f` | boolean | false | Overwrite existing config |
| `--template <t>` | string | "default" | Template: `default`, `minimal`, `full` |

### Examples

```bash
# Create default config
hambugsy init

# Overwrite existing config
hambugsy init --force

# Create minimal config
hambugsy init --template=minimal

# Create full config with all options
hambugsy init --template=full
```

### Generated File

Creates `.hambugsy.yml` in current directory:

```yaml
# .hambugsy.yml
version: 1

patterns:
  source:
    - "src/**/*.java"
    - "src/**/*.ts"
  test:
    - "test/**/*.java"
    - "**/*.test.ts"

analysis:
  git_history_days: 90
  confidence_threshold: 0.7

ci:
  fail_on_bugs: true
  fail_on_outdated_tests: false
```

---

## version

Show version and environment information.

### Synopsis

```bash
hambugsy version [options]
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `--check` | boolean | Check for updates |
| `--json` | boolean | Output as JSON |

### Examples

```bash
# Show version
hambugsy version

# Check for updates
hambugsy version --check

# Machine-readable version
hambugsy version --json
```

### Output

```
🍔 Hambugsy v1.0.0

Environment:
  Node.js:    v20.10.0
  Platform:   darwin (arm64)
  Git:        2.43.0
  gh CLI:     2.42.0
  Copilot:    0.5.0

Config:
  File:       .hambugsy.yml
  Languages:  java, typescript, python
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HAMBUGSY_CONFIG` | Path to config file | `.hambugsy.yml` |
| `HAMBUGSY_CACHE_DIR` | Cache directory | `~/.cache/hambugsy` |
| `HAMBUGSY_NO_COLOR` | Disable colors | `false` |
| `HAMBUGSY_VERBOSE` | Enable verbose | `false` |
| `HAMBUGSY_PARALLEL` | Parallel count | `4` |
| `GITHUB_TOKEN` | GitHub token for API | - |
| `GH_COPILOT_TIMEOUT` | Copilot timeout (ms) | `30000` |

### Example

```bash
# Set via environment
export HAMBUGSY_VERBOSE=true
export HAMBUGSY_PARALLEL=8
hambugsy analyze ./src

# Inline override
HAMBUGSY_NO_COLOR=true hambugsy analyze ./src
```

---

## Shell Completion

### Bash

```bash
# Add to ~/.bashrc
eval "$(hambugsy completion bash)"
```

### Zsh

```bash
# Add to ~/.zshrc
eval "$(hambugsy completion zsh)"
```

### Fish

```fish
# Add to ~/.config/fish/config.fish
hambugsy completion fish | source
```

### PowerShell

```powershell
# Add to $PROFILE
hambugsy completion powershell | Out-String | Invoke-Expression
```

---

## Common Patterns

### CI/CD Pipeline

```bash
# Fail pipeline if code bugs found
hambugsy analyze ./src --format=github
exit_code=$?

if [ $exit_code -eq 1 ]; then
  echo "Code bugs detected!"
  exit 1
fi
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Only analyze changed files
changed_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(java|ts|py)$')

if [ -n "$changed_files" ]; then
  hambugsy analyze $changed_files --quiet
fi
```

### Watch Mode (with external tool)

```bash
# Using nodemon
nodemon --ext java,ts,py --exec "hambugsy analyze ./src"

# Using watchexec
watchexec -e java,ts,py "hambugsy analyze ./src"
```

### Filtering with jq

```bash
# Get only code bugs
hambugsy analyze ./src --format=json | jq '.results[] | select(.verdict.type == "CODE_BUG")'

# Count by verdict type
hambugsy analyze ./src --format=json | jq '.summary'

# Get file list for outdated tests
hambugsy analyze ./src --format=json | jq -r '.results[] | select(.verdict.type == "OUTDATED_TEST") | .test.file'
```
