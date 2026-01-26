# Hambugsy Technical Specification

## Version 1.0.0

---

## 1. Overview

### 1.1 Purpose

Hambugsy is a command-line tool that analyzes failing tests and determines whether the fault lies in the test code or the implementation code. It uses GitHub Copilot CLI for intelligent analysis and provides actionable recommendations.

### 1.2 Core Value Proposition

| Traditional Debugging | With Hambugsy |
|-----------------------|---------------|
| Test fails → investigate manually | Test fails → instant verdict |
| 30-60 min per failure | < 30 seconds per failure |
| Requires context knowledge | Works without prior knowledge |
| Binary: fix test or fix code | Clear recommendation with reasoning |

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HAMBUGSY CLI                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │
│  │  Parser   │  │ Analyzer  │  │  Copilot  │  │ Reporter  │        │
│  │  Module   │  │  Module   │  │  Bridge   │  │  Module   │        │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │
│        │              │              │              │               │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │   Core Engine     │                            │
│                    │  (Orchestrator)   │                            │
│                    └─────────┬─────────┘                            │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                              │                                      │
│  ┌───────────────────────────▼────────────────────────────────┐     │
│  │                    External Services                        │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │     │
│  │  │   Git    │  │  GitHub  │  │  Copilot │  │   File   │    │     │
│  │  │  Binary  │  │   API    │  │   CLI    │  │  System  │    │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Descriptions

#### 2.2.1 Parser Module

Responsible for extracting structured information from source files.

```typescript
interface ParserModule {
  // Parse test file and extract test cases
  parseTestFile(path: string): Promise<TestCase[]>;
  
  // Parse source file and extract methods/functions
  parseSourceFile(path: string): Promise<SourceMethod[]>;
  
  // Match tests to their corresponding source methods
  correlate(tests: TestCase[], source: SourceMethod[]): TestSourcePair[];
}

interface TestCase {
  name: string;
  filePath: string;
  lineNumber: number;
  assertions: Assertion[];
  setupCode: string;
  lastModified: Date;
}

interface SourceMethod {
  name: string;
  filePath: string;
  lineNumber: number;
  parameters: Parameter[];
  returnType: string;
  body: string;
  lastModified: Date;
}
```

#### 2.2.2 Analyzer Module

Performs semantic analysis of test-source pairs.

```typescript
interface AnalyzerModule {
  // Analyze a test-source pair
  analyze(pair: TestSourcePair): Promise<AnalysisResult>;
  
  // Determine if test expectation matches code behavior
  compareExpectations(test: TestCase, source: SourceMethod): ExpectationComparison;
  
  // Check for common patterns
  detectPatterns(source: SourceMethod): Pattern[];
}

interface AnalysisResult {
  pair: TestSourcePair;
  testExpectation: Expectation;
  codeActualBehavior: Behavior;
  divergencePoint: DivergenceInfo | null;
  confidence: number;  // 0.0 - 1.0
}
```

#### 2.2.3 Copilot Bridge

Interface to GitHub Copilot CLI for AI-powered analysis.

```typescript
interface CopilotBridge {
  // Ask Copilot to analyze code semantics
  analyzeSemantics(code: string, context: string): Promise<SemanticAnalysis>;
  
  // Ask Copilot to explain the difference between expected and actual
  explainDivergence(test: string, source: string): Promise<Explanation>;
  
  // Ask Copilot to suggest a fix
  suggestFix(issue: Issue): Promise<FixSuggestion>;
  
  // Raw query to Copilot
  query(prompt: string): Promise<string>;
}

// Implementation uses gh copilot suggest/explain commands
class CopilotBridgeImpl implements CopilotBridge {
  async query(prompt: string): Promise<string> {
    const result = await exec(`gh copilot suggest -t shell "${prompt}"`);
    return result.stdout;
  }
}
```

#### 2.2.4 Reporter Module

Generates output in various formats.

```typescript
interface ReporterModule {
  // Generate console output
  toConsole(results: VerdictResult[]): void;
  
  // Generate JSON output
  toJSON(results: VerdictResult[]): string;
  
  // Generate Markdown report
  toMarkdown(results: VerdictResult[]): string;
  
  // Generate GitHub Actions annotations
  toGitHubActions(results: VerdictResult[]): string;
}
```

---

## 3. Data Flow

### 3.1 Analysis Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Input  │───▶│  Parse  │───▶│ Analyze │───▶│ Verdict │───▶│ Report  │
│  Files  │    │  Files  │    │  Pairs  │    │ Engine  │    │ Output  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │              │              │
                   ▼              ▼              ▼
              ┌─────────┐   ┌─────────┐    ┌─────────┐
              │   AST   │   │ Copilot │    │   Git   │
              │ Parser  │   │   CLI   │    │ History │
              └─────────┘   └─────────┘    └─────────┘
```

### 3.2 Verdict Decision Flow

```typescript
async function determineVerdict(analysis: AnalysisResult): Promise<Verdict> {
  // Step 1: Get git history for both files
  const testHistory = await git.getHistory(analysis.pair.test.filePath);
  const sourceHistory = await git.getHistory(analysis.pair.source.filePath);
  
  // Step 2: Determine which changed more recently
  const testLastChanged = testHistory[0].date;
  const sourceLastChanged = sourceHistory[0].date;
  
  // Step 3: Ask Copilot to analyze intent
  const testIntent = await copilot.analyzeSemantics(
    analysis.pair.test.body,
    "What is this test trying to verify?"
  );
  
  const sourceIntent = await copilot.analyzeSemantics(
    analysis.pair.source.body,
    "What does this code actually do?"
  );
  
  // Step 4: Compare and decide
  if (sourceLastChanged > testLastChanged) {
    // Code changed after test was written
    const commitMessage = sourceHistory[0].message;
    
    if (isIntentionalChange(commitMessage)) {
      return {
        type: VerdictType.OUTDATED_TEST,
        reason: `Code intentionally changed: "${commitMessage}"`,
        recommendation: generateTestUpdate(analysis)
      };
    } else {
      return {
        type: VerdictType.CODE_BUG,
        reason: "Code change appears to be regression",
        recommendation: generateCodeFix(analysis)
      };
    }
  } else {
    // Test is newer or same age
    return {
      type: VerdictType.CODE_BUG,
      reason: "Test expectation not met by implementation",
      recommendation: generateCodeFix(analysis)
    };
  }
}
```

---

## 4. GitHub Copilot CLI Integration

### 4.1 Copilot CLI Commands Used

```bash
# Semantic analysis
gh copilot explain "What does this function do: [code]"

# Suggestion generation
gh copilot suggest -t code "Fix this null pointer issue: [context]"

# Shell command assistance (for git operations)
gh copilot suggest -t shell "Get git blame for line 47 of file.java"
```

### 4.2 Prompt Templates

#### Test Intent Analysis

```
Analyze this test and describe what behavior it expects:

```[language]
[test code]
```

Focus on:
1. What input is provided?
2. What output/behavior is expected?
3. What edge cases are tested?
4. Any implicit assumptions?

Respond in JSON format:
{
  "expectedInput": "...",
  "expectedOutput": "...",
  "edgeCases": [...],
  "assumptions": [...]
}
```

#### Source Behavior Analysis

```
Analyze this function and describe its actual behavior:

```[language]
[source code]
```

Focus on:
1. What does it return/produce?
2. How does it handle edge cases?
3. Any potential issues?

Respond in JSON format:
{
  "actualBehavior": "...",
  "edgeCaseHandling": {...},
  "potentialIssues": [...]
}
```

#### Fix Suggestion

```
Given this failing test:
```[language]
[test code]
```

And this implementation:
```[language]
[source code]
```

The test expects: [expected]
The code produces: [actual]

Suggest a fix. Should we update the test or the code?
Consider:
- Recent git history shows: [git context]
- Business logic intent appears to be: [intent]

Respond in JSON format:
{
  "fixTarget": "test|code",
  "reason": "...",
  "suggestedChange": {
    "file": "...",
    "line": N,
    "before": "...",
    "after": "..."
  }
}
```

---

## 5. Language Support

### 5.1 Parser Implementations

Each language requires a specific parser implementation:

```typescript
interface LanguageParser {
  language: string;
  testFrameworks: string[];
  
  // Parse file into AST
  parse(content: string): AST;
  
  // Extract test cases from AST
  extractTests(ast: AST): TestCase[];
  
  // Extract methods/functions from AST
  extractMethods(ast: AST): SourceMethod[];
  
  // Map test name to source method
  resolveTestTarget(test: TestCase): string;
}
```

### 5.2 Java/JUnit Parser

```typescript
class JavaJUnitParser implements LanguageParser {
  language = 'java';
  testFrameworks = ['junit4', 'junit5', 'testng'];
  
  parse(content: string): AST {
    // Use tree-sitter-java or java-parser
    return JavaParser.parse(content);
  }
  
  extractTests(ast: AST): TestCase[] {
    // Find methods annotated with @Test
    return ast.findAll('method_declaration')
      .filter(m => m.hasAnnotation('Test'))
      .map(m => ({
        name: m.name,
        lineNumber: m.startLine,
        assertions: this.extractAssertions(m),
        // ...
      }));
  }
  
  resolveTestTarget(test: TestCase): string {
    // Convention: testCalculateDiscount -> calculateDiscount
    return test.name.replace(/^test/, '')
      .replace(/^[A-Z]/, c => c.toLowerCase());
  }
}
```

### 5.3 TypeScript/Jest Parser

```typescript
class TypeScriptJestParser implements LanguageParser {
  language = 'typescript';
  testFrameworks = ['jest', 'mocha', 'vitest'];
  
  parse(content: string): AST {
    // Use TypeScript compiler API
    return ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest);
  }
  
  extractTests(ast: AST): TestCase[] {
    // Find it(), test(), describe() blocks
    return ast.findAll('call_expression')
      .filter(c => ['it', 'test'].includes(c.name))
      .map(c => ({
        name: c.arguments[0].text,
        lineNumber: c.startLine,
        assertions: this.extractExpects(c),
        // ...
      }));
  }
}
```

---

## 6. Git Integration

### 6.1 History Analysis

```typescript
interface GitService {
  // Get file modification history
  getHistory(filePath: string, limit?: number): Promise<Commit[]>;
  
  // Get blame information for specific lines
  blame(filePath: string, startLine: number, endLine: number): Promise<BlameInfo[]>;
  
  // Get diff between commits
  diff(commit1: string, commit2: string, filePath: string): Promise<Diff>;
  
  // Find when a specific line was last modified
  findLastModification(filePath: string, lineNumber: number): Promise<Commit>;
}

interface Commit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
}

interface BlameInfo {
  lineNumber: number;
  commit: Commit;
  originalLine: number;
}
```

### 6.2 Change Intent Detection

```typescript
function isIntentionalChange(commitMessage: string): boolean {
  const intentionalPatterns = [
    /^feat:/i,
    /^refactor:/i,
    /update.*policy/i,
    /change.*logic/i,
    /new.*requirement/i,
    /TICKET-\d+/i,
    /JIRA-\d+/i,
  ];
  
  const accidentalPatterns = [
    /^fix:/i,
    /bug/i,
    /typo/i,
    /oops/i,
    /revert/i,
  ];
  
  for (const pattern of intentionalPatterns) {
    if (pattern.test(commitMessage)) return true;
  }
  
  for (const pattern of accidentalPatterns) {
    if (pattern.test(commitMessage)) return false;
  }
  
  return true; // Default to intentional
}
```

---

## 7. CLI Interface

### 7.1 Command Structure

```
hambugsy <command> [options] [arguments]

Commands:
  analyze <path>     Analyze source files for test/code issues
  suggest <path>     Find missing tests and generate suggestions
  fix <path>         Auto-fix issues (with confirmation)
  report <path>      Generate detailed report
  init               Initialize configuration file
  version            Show version information

Global Options:
  --config <path>    Path to config file (default: .hambugsy.yml)
  --verbose          Enable verbose output
  --quiet            Suppress non-essential output
  --no-color         Disable colored output
  --json             Output as JSON
```

### 7.2 Analyze Command

```
hambugsy analyze <path> [options]

Arguments:
  path               File or directory to analyze

Options:
  --recursive, -r    Analyze directories recursively
  --filter <type>    Filter results: bugs, tests, all (default: all)
  --test <name>      Analyze specific test by name
  --format <fmt>     Output format: console, json, markdown, github
  --confidence <n>   Minimum confidence threshold (0.0-1.0)
  --since <date>     Only analyze changes since date
  --parallel <n>     Number of parallel analyses (default: 4)

Examples:
  hambugsy analyze ./src/OrderService.java
  hambugsy analyze ./src --recursive --filter=bugs
  hambugsy analyze ./src --format=json > report.json
  hambugsy analyze ./src --test="testCalculateDiscount"
```

### 7.3 Suggest Command (Missing Test Detection)

```
hambugsy suggest <path> [options]

Arguments:
  path               File or directory to analyze for missing tests

Options:
  --recursive, -r    Analyze directories recursively
  --format <fmt>     Output format: console, json, markdown
  --generate         Generate actual test code (not just suggestions)
  --priority <p>     Filter by priority: critical, high, medium, all
  --output <dir>     Write generated tests to directory

Examples:
  hambugsy suggest ./src/OrderService.java
  hambugsy suggest ./src --recursive --priority=critical
  hambugsy suggest ./src --generate --output=./generated-tests/
```

**Detected Patterns:**

| Pattern | Priority | Description |
|---------|----------|-------------|
| No tests at all | CRITICAL | Public method has zero test coverage |
| Null input | HIGH | No test for null/undefined parameter |
| Empty collection | HIGH | No test for empty array/list/map |
| Boundary values | MEDIUM | No test for 0, -1, MAX_VALUE |
| Exception paths | HIGH | No test for thrown exceptions |
| Async errors | HIGH | No test for Promise rejection/timeout |

### 7.4 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, no issues found |
| 1 | Success, issues found |
| 2 | Configuration error |
| 3 | Parse error |
| 4 | Copilot CLI not available |
| 5 | Git not available |
| 10 | Unknown error |

---

## 8. Configuration

### 8.1 Configuration File Schema

```yaml
# .hambugsy.yml
version: 1

# File patterns
patterns:
  source:
    - "src/**/*.java"
    - "src/**/*.ts"
    - "src/**/*.py"
  test:
    - "test/**/*.java"
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/*_test.py"
  
  # Test-to-source mapping overrides
  mapping:
    - test: "**/*IT.java"      # Integration tests
      source: "src/**/*.java"
    - test: "**/*.e2e.ts"      # E2E tests
      source: "src/**/*.ts"

# Analysis settings
analysis:
  # Git history lookback period (days)
  git_history_days: 90
  
  # Confidence threshold (0.0-1.0)
  confidence_threshold: 0.7
  
  # Include detailed explanation
  explain: true
  
  # Language-specific settings
  languages:
    java:
      test_frameworks: ["junit5", "testng"]
      source_pattern: "src/main/java/**/*.java"
      test_pattern: "src/test/java/**/*.java"
    
    typescript:
      test_frameworks: ["jest"]
      source_pattern: "src/**/*.ts"
      test_pattern: "**/*.test.ts"

# Ignore patterns
ignore:
  files:
    - "**/generated/**"
    - "**/node_modules/**"
    - "**/*.d.ts"
  
  tests:
    - "**/*.mock.ts"
    - "**/*IT.java"  # Skip integration tests
  
  methods:
    - "toString"
    - "hashCode"
    - "equals"

# Verdict weights (for edge cases)
weights:
  # Increase likelihood of "outdated test" verdict
  prefer_test_update: 0.6  # 0.5 = neutral
  
  # Trust commit messages
  trust_commit_message: 0.8

# CI/CD integration
ci:
  # Exit with error if code bugs found
  fail_on_bugs: true
  
  # Exit with error if outdated tests found  
  fail_on_outdated_tests: false
  
  # Generate report artifact
  report:
    enabled: true
    format: "markdown"
    path: "./hambugsy-report.md"
  
  # GitHub Actions specific
  github:
    annotations: true
    comment_on_pr: true

# Copilot settings
copilot:
  # Model preference (if available)
  model: "default"
  
  # Max tokens for analysis
  max_tokens: 2000
  
  # Temperature for creativity (0.0-1.0)
  temperature: 0.3
```

---

## 9. Output Formats

### 9.1 Console Output

```
🍔 HAMBUGSY v1.0.0 - Finding the bug in your stack...

Analyzing: ./src/OrderService.java
Found: 3 tests, 5 methods

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: calculateTotal() @ line 47                          │
├─────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: testCalculateTotal_WithDiscount               │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Test expects: 10% discount → total = 90.00                 │
│  ├── Code applies: 15% discount → total = 85.00                 │
│  ├── Test written: 2024-03-15 by alice@example.com              │
│  └── Code changed: 2024-11-22 by bob@example.com                │
│      Commit: "feat: update discount policy to 15%"              │
│                                                                 │
│  🎯 VERDICT: OUTDATED TEST (confidence: 94%)                    │
│                                                                 │
│  💡 RECOMMENDATION:                                              │
│  Update OrderServiceTest.java line 23:                          │
│  - assertEquals(90.0, result);                                  │
│  + assertEquals(85.0, result);                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: validateOrder() @ line 82                           │
├─────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: testValidateOrder_EmptyCart                   │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Test expects: ValidationException thrown                   │
│  ├── Code does: Returns null (missing null check)               │
│  └── No recent changes to method                                │
│                                                                 │
│  🎯 VERDICT: CODE BUG (confidence: 89%)                         │
│                                                                 │
│  💡 RECOMMENDATION:                                              │
│  Add null check in OrderService.java before line 84:            │
│  + if (cart == null || cart.isEmpty()) {                        │
│  +     throw new ValidationException("Cart cannot be empty");   │
│  + }                                                            │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total analyzed:    5 methods, 3 tests
  Code bugs:         1 🐛
  Outdated tests:    1 📜
  Flaky tests:       0 🎲
  Passed:            1 ✅

  Estimated time saved: ~45 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 9.2 JSON Output

```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "analyzed": {
    "files": ["./src/OrderService.java"],
    "methods": 5,
    "tests": 3
  },
  "results": [
    {
      "method": {
        "name": "calculateTotal",
        "file": "./src/OrderService.java",
        "line": 47
      },
      "test": {
        "name": "testCalculateTotal_WithDiscount",
        "file": "./test/OrderServiceTest.java",
        "line": 20
      },
      "verdict": {
        "type": "OUTDATED_TEST",
        "confidence": 0.94,
        "reason": "Code intentionally changed with commit message: 'feat: update discount policy to 15%'"
      },
      "analysis": {
        "testExpectation": "10% discount applied to total",
        "codeBehavior": "15% discount applied to total",
        "testLastModified": "2024-03-15T09:00:00Z",
        "codeLastModified": "2024-11-22T14:30:00Z",
        "relevantCommit": {
          "hash": "a1b2c3d",
          "message": "feat: update discount policy to 15%",
          "author": "bob@example.com"
        }
      },
      "recommendation": {
        "action": "UPDATE_TEST",
        "file": "./test/OrderServiceTest.java",
        "line": 23,
        "before": "assertEquals(90.0, result);",
        "after": "assertEquals(85.0, result);"
      }
    }
  ],
  "summary": {
    "codeBugs": 1,
    "outdatedTests": 1,
    "flakyTests": 0,
    "passed": 1,
    "estimatedTimeSaved": "45 minutes"
  }
}
```

### 9.3 GitHub Actions Annotations

```
::error file=src/OrderService.java,line=82,col=5::CODE BUG: Missing null check in validateOrder(). Test expects ValidationException but code returns null.
::warning file=test/OrderServiceTest.java,line=23,col=9::OUTDATED TEST: Update assertion from 90.0 to 85.0 to match new discount policy.
```

---

## 10. Error Handling

### 10.1 Error Categories

```typescript
enum ErrorCategory {
  CONFIG_ERROR = 'CONFIG_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  GIT_ERROR = 'GIT_ERROR',
  COPILOT_ERROR = 'COPILOT_ERROR',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',
  IO_ERROR = 'IO_ERROR',
}

class HambugsyError extends Error {
  category: ErrorCategory;
  recoverable: boolean;
  suggestion?: string;
}
```

### 10.2 Error Messages

| Error | Message | Suggestion |
|-------|---------|------------|
| Copilot not installed | "GitHub Copilot CLI not found" | "Run: gh extension install github/gh-copilot" |
| Not authenticated | "Not authenticated with GitHub" | "Run: gh auth login" |
| No git repo | "Not a git repository" | "Initialize git or run from repo root" |
| Parse failed | "Failed to parse {file}" | "Check file syntax or report language bug" |
| No tests found | "No test files found" | "Check patterns in .hambugsy.yml" |

---

## 11. Performance

### 11.1 Optimization Strategies

1. **Parallel Analysis**: Analyze multiple files concurrently
2. **Caching**: Cache parsed ASTs and git history
3. **Incremental**: Only analyze changed files
4. **Lazy Loading**: Parse source files only when needed

### 11.2 Benchmarks

| Scenario | Files | Tests | Time |
|----------|-------|-------|------|
| Small project | 10 | 50 | ~5s |
| Medium project | 100 | 500 | ~30s |
| Large project | 1000 | 5000 | ~3min |

---

## 12. Security

### 12.1 Data Handling

- Source code is sent to Copilot CLI for analysis
- No code is stored externally
- All analysis happens locally except Copilot queries
- Sensitive patterns can be excluded via config

### 12.2 Authentication

- Uses GitHub CLI authentication (`gh auth`)
- Requires Copilot CLI extension
- No additional credentials needed

---

## 13. Future Enhancements

### 13.1 Planned Features

- [ ] IDE extensions (VS Code, IntelliJ)
- [ ] Auto-fix mode with human confirmation
- [ ] Team analytics and trends
- [ ] Integration with issue trackers
- [ ] Custom verdict rules
- [ ] Machine learning for pattern detection

### 13.2 API Extensibility

```typescript
// Plugin interface for custom analyzers
interface HambugsyPlugin {
  name: string;
  version: string;
  
  // Custom parser for new language
  parser?: LanguageParser;
  
  // Custom verdict logic
  verdictModifier?: (verdict: Verdict) => Verdict;
  
  // Custom reporter
  reporter?: ReporterModule;
}

// Register plugin
hambugsy.registerPlugin(myPlugin);
```
