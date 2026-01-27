# Hambugsy Configuration Reference

> **Version:** 1.0.2 | **npm:** [npmjs.com/package/hambugsy](https://www.npmjs.com/package/hambugsy)

## Overview

Hambugsy uses YAML configuration files. By default, it looks for `.hambugsy.yml` in the current directory.

## Supported Languages

| Language | Test Frameworks | File Extensions |
|----------|-----------------|-----------------|
| Java | JUnit 4/5, TestNG | `.java` |
| TypeScript | Jest, Vitest, Mocha | `.ts`, `.tsx` |
| JavaScript | Jest, Vitest, Mocha | `.js`, `.jsx` |
| Python | pytest, unittest | `.py` |
| Go | go test, testify | `.go` |
| Rust | #[test], tokio::test | `.rs` |
| C# | NUnit, xUnit, MSTest | `.cs` |

---

## Configuration File Location

Hambugsy searches for configuration in this order:

1. `--config` CLI argument
2. `HAMBUGSY_CONFIG` environment variable
3. `.hambugsy.yml` in current directory
4. `.hambugsy.yaml` in current directory
5. `hambugsy.yml` in current directory
6. `~/.config/hambugsy/config.yml` (user config)
7. Built-in defaults

---

## Full Configuration Schema

```yaml
# .hambugsy.yml
# Hambugsy Configuration File

# Schema version (required)
version: 1

# =============================================================================
# FILE PATTERNS
# =============================================================================

patterns:
  # Source code patterns (glob patterns)
  source:
    - "src/**/*.java"
    - "src/**/*.ts"
    - "src/**/*.tsx"
    - "src/**/*.py"
    - "lib/**/*.java"
  
  # Test file patterns (glob patterns)
  test:
    - "test/**/*.java"
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/*_test.py"
    - "tests/**/*.py"
  
  # Custom mapping overrides (optional)
  # Maps test patterns to source patterns
  mapping:
    - test: "**/*IT.java"           # Integration tests
      source: "src/main/**/*.java"
    - test: "**/*.e2e.ts"           # E2E tests
      source: "src/**/*.ts"
    - test: "**/*_integration_test.py"
      source: "src/**/*.py"

# =============================================================================
# ANALYSIS SETTINGS
# =============================================================================

analysis:
  # How many days of git history to analyze
  # Higher = more context, slower analysis
  # Default: 90
  git_history_days: 90
  
  # Minimum confidence threshold for verdicts (0.0 - 1.0)
  # Lower = more results, potentially less accurate
  # Higher = fewer results, more confident
  # Default: 0.7
  confidence_threshold: 0.7
  
  # Include detailed AI explanation in output
  # Default: true
  explain: true
  
  # Maximum methods to analyze per file
  # Default: 50
  max_methods_per_file: 50
  
  # Timeout for analysis per method (milliseconds)
  # Default: 30000 (30 seconds)
  timeout_per_method: 30000
  
  # Language-specific settings
  languages:
    java:
      # Supported test frameworks
      test_frameworks:
        - junit5
        - junit4
        - testng
      
      # Override source pattern for Java
      source_pattern: "src/main/java/**/*.java"
      test_pattern: "src/test/java/**/*.java"
      
      # Java-specific options
      options:
        # Include static methods
        include_static: true
        # Include private methods
        include_private: false
    
    typescript:
      test_frameworks:
        - jest
        - mocha
        - vitest
      
      source_pattern: "src/**/*.ts"
      test_pattern: "**/*.test.ts"
      
      options:
        # Include arrow functions
        include_arrow_functions: true
        # Analyze .tsx files
        include_tsx: true
    
    python:
      test_frameworks:
        - pytest
        - unittest
      
      source_pattern: "src/**/*.py"
      test_pattern: "**/test_*.py"
      
      options:
        # Include async functions
        include_async: true

# =============================================================================
# IGNORE PATTERNS
# =============================================================================

ignore:
  # Files to ignore (glob patterns)
  files:
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/build/**"
    - "**/target/**"
    - "**/.git/**"
    - "**/generated/**"
    - "**/*.d.ts"
    - "**/__pycache__/**"
  
  # Tests to ignore
  tests:
    - "**/*.mock.ts"
    - "**/*IT.java"           # Integration tests
    - "**/*E2E.java"          # E2E tests
    - "**/fixtures/**"
    - "**/testutil/**"
  
  # Methods to ignore (by name)
  methods:
    - "toString"
    - "hashCode"
    - "equals"
    - "compareTo"
    - "main"
    - "__init__"
    - "__str__"
    - "__repr__"
  
  # Patterns in method names to ignore (regex)
  method_patterns:
    - "^get[A-Z]"             # Getters
    - "^set[A-Z]"             # Setters
    - "^is[A-Z]"              # Boolean getters
    - "^__.*__$"              # Python dunder methods

# =============================================================================
# VERDICT WEIGHTS
# =============================================================================

weights:
  # Bias toward "outdated test" vs "code bug" verdict
  # 0.5 = neutral
  # > 0.5 = prefer "outdated test"
  # < 0.5 = prefer "code bug"
  # Default: 0.5
  prefer_test_update: 0.5
  
  # How much to trust commit messages for intent
  # 0.0 = ignore commit messages
  # 1.0 = fully trust commit messages
  # Default: 0.8
  trust_commit_message: 0.8
  
  # Weight for code age vs test age
  # Higher = more weight to recent changes
  # Default: 1.0
  recency_weight: 1.0
  
  # Patterns that indicate intentional changes
  intentional_commit_patterns:
    - "^feat:"
    - "^feature:"
    - "^refactor:"
    - "update.*policy"
    - "change.*logic"
    - "new.*requirement"
    - "\\[.*\\]"              # Ticket references
  
  # Patterns that indicate accidental changes
  accidental_commit_patterns:
    - "^fix:"
    - "^bugfix:"
    - "^hotfix:"
    - "bug"
    - "typo"
    - "oops"
    - "revert"

# =============================================================================
# CI/CD SETTINGS
# =============================================================================

ci:
  # Exit with non-zero if code bugs found
  # Default: true
  fail_on_bugs: true
  
  # Exit with non-zero if outdated tests found
  # Default: false
  fail_on_outdated_tests: false
  
  # Exit with non-zero if flaky tests found
  # Default: false
  fail_on_flaky: false
  
  # Generate report artifact
  report:
    enabled: true
    format: "markdown"        # markdown, html, json
    path: "./hambugsy-report.md"
  
  # GitHub-specific settings
  github:
    # Create annotations on files
    annotations: true
    
    # Comment on pull requests
    comment_on_pr: true
    
    # Update PR status check
    status_check: true
  
  # GitLab-specific settings
  gitlab:
    # Create code quality report
    code_quality_report: true
    
    # Create JUnit report
    junit_report: true

# =============================================================================
# COPILOT SETTINGS
# =============================================================================

copilot:
  # Model preference (if multiple available)
  # Default: "default"
  model: "default"
  
  # Maximum tokens for analysis responses
  # Higher = more detailed analysis, slower
  # Default: 2000
  max_tokens: 2000
  
  # Temperature for AI responses (0.0 - 1.0)
  # Lower = more deterministic
  # Higher = more creative
  # Default: 0.3
  temperature: 0.3
  
  # Request timeout (milliseconds)
  # Default: 30000
  timeout: 30000
  
  # Retry failed requests
  retry:
    enabled: true
    max_attempts: 3
    delay: 1000

# =============================================================================
# CACHING
# =============================================================================

cache:
  # Enable caching
  # Default: true
  enabled: true
  
  # Cache directory
  # Default: ~/.cache/hambugsy
  directory: "~/.cache/hambugsy"
  
  # Cache TTL in seconds
  # Default: 86400 (24 hours)
  ttl: 86400
  
  # Maximum cache size in MB
  # Default: 100
  max_size_mb: 100
  
  # What to cache
  items:
    ast: true                 # Parsed AST
    git_history: true         # Git blame/history
    copilot_responses: true   # AI responses

# =============================================================================
# OUTPUT SETTINGS
# =============================================================================

output:
  # Default output format
  # Default: "console"
  format: "console"
  
  # Use colors in output
  # Default: true (auto-detected)
  color: true
  
  # Show progress spinner
  # Default: true
  spinner: true
  
  # Truncate long code snippets
  # Default: true
  truncate_code: true
  
  # Maximum lines to show per snippet
  # Default: 10
  max_code_lines: 10

# =============================================================================
# LOGGING
# =============================================================================

logging:
  # Log level: debug, info, warn, error
  # Default: info
  level: "info"
  
  # Log file path (optional)
  # Default: none (stderr only)
  file: "./hambugsy.log"
  
  # Include timestamps
  # Default: true
  timestamps: true
```

---

## Configuration Examples

### Minimal Configuration

```yaml
version: 1

patterns:
  source:
    - "src/**/*.java"
  test:
    - "test/**/*.java"
```

### Java Spring Boot Project

```yaml
version: 1

patterns:
  source:
    - "src/main/java/**/*.java"
  test:
    - "src/test/java/**/*.java"

analysis:
  languages:
    java:
      test_frameworks: [junit5]

ignore:
  tests:
    - "**/*IT.java"
    - "**/*IntegrationTest.java"

ci:
  fail_on_bugs: true
  github:
    annotations: true
```

### TypeScript/Node.js Project

```yaml
version: 1

patterns:
  source:
    - "src/**/*.ts"
    - "!src/**/*.d.ts"
  test:
    - "**/*.test.ts"
    - "**/*.spec.ts"

analysis:
  languages:
    typescript:
      test_frameworks: [jest]
      options:
        include_tsx: false

ignore:
  files:
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/*.d.ts"
```

### Python/Django Project

```yaml
version: 1

patterns:
  source:
    - "app/**/*.py"
    - "!app/**/migrations/**"
  test:
    - "**/test_*.py"
    - "**/*_test.py"

analysis:
  languages:
    python:
      test_frameworks: [pytest]

ignore:
  files:
    - "**/migrations/**"
    - "**/__pycache__/**"
  methods:
    - "__init__"
    - "__str__"
```

### Go Project

```yaml
version: 1

patterns:
  source:
    - "**/*.go"
    - "!**/*_test.go"
  test:
    - "**/*_test.go"

analysis:
  languages:
    go:
      test_frameworks: [go-test, testify]
```

### Rust Project

```yaml
version: 1

patterns:
  source:
    - "src/**/*.rs"
    - "!src/**/*_test.rs"
  test:
    - "tests/**/*.rs"
    - "src/**/*_test.rs"

analysis:
  languages:
    rust:
      test_frameworks: [rust-test, tokio-test]
```

### C# Project

```yaml
version: 1

patterns:
  source:
    - "src/**/*.cs"
  test:
    - "tests/**/*.cs"
    - "**/*Tests.cs"

analysis:
  languages:
    csharp:
      test_frameworks: [nunit, xunit, mstest]
```

### Monorepo Configuration

```yaml
version: 1

patterns:
  source:
    - "packages/*/src/**/*.ts"
    - "services/*/src/**/*.java"
  test:
    - "packages/*/**/*.test.ts"
    - "services/*/src/test/**/*.java"
  mapping:
    - test: "packages/api/**/*.test.ts"
      source: "packages/api/src/**/*.ts"
    - test: "packages/web/**/*.test.ts"
      source: "packages/web/src/**/*.ts"

analysis:
  max_methods_per_file: 100
  timeout_per_method: 60000

cache:
  enabled: true
  max_size_mb: 500
```

### Strict CI Configuration

```yaml
version: 1

patterns:
  source:
    - "src/**/*"
  test:
    - "test/**/*"

analysis:
  confidence_threshold: 0.9

ci:
  fail_on_bugs: true
  fail_on_outdated_tests: true
  fail_on_flaky: true
  github:
    annotations: true
    comment_on_pr: true
    status_check: true
```

---

## Environment Variable Overrides

Any configuration option can be overridden via environment variables:

```bash
# Pattern: HAMBUGSY_<SECTION>_<OPTION>

# Override confidence threshold
export HAMBUGSY_ANALYSIS_CONFIDENCE_THRESHOLD=0.9

# Override fail on bugs
export HAMBUGSY_CI_FAIL_ON_BUGS=false

# Override cache directory
export HAMBUGSY_CACHE_DIRECTORY=/tmp/hambugsy-cache

# Override log level
export HAMBUGSY_LOGGING_LEVEL=debug
```

---

## Validating Configuration

```bash
# Check configuration validity
hambugsy config validate

# Show effective configuration (with defaults)
hambugsy config show

# Show where config was loaded from
hambugsy config path
```
