# Hambugsy Implementation Guide

## Quick Start (MVP in 2 weeks)

This guide walks you through implementing Hambugsy from scratch.

---

## Phase 1: Project Setup (Day 1)

### Initialize Project

```bash
mkdir hambugsy
cd hambugsy
npm init -y

# Install dependencies
npm install commander chalk ora execa tree-sitter tree-sitter-java \
            tree-sitter-typescript p-queue level

# Dev dependencies
npm install -D typescript @types/node vitest esbuild
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json Scripts

```json
{
  "name": "hambugsy",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "hambugsy": "./dist/index.js"
  },
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm",
    "dev": "tsx src/index.ts",
    "test": "vitest",
    "lint": "eslint src/",
    "prepare": "npm run build"
  }
}
```

---

## Phase 2: Core Types (Day 1-2)

### src/types.ts

```typescript
// Core types for Hambugsy

export interface TestCase {
  name: string;
  filePath: string;
  lineNumber: number;
  endLine: number;
  framework: TestFramework;
  assertions: Assertion[];
  body: string;
}

export interface Assertion {
  type: 'equals' | 'throws' | 'truthy' | 'contains' | 'other';
  expected: string;
  actual?: string;
  lineNumber: number;
  raw: string;
}

export interface SourceMethod {
  name: string;
  filePath: string;
  lineNumber: number;
  endLine: number;
  parameters: Parameter[];
  returnType: string;
  body: string;
  className?: string;
}

export interface Parameter {
  name: string;
  type: string;
}

export interface TestSourcePair {
  test: TestCase;
  source: SourceMethod;
  confidence: number;
  correlationType: CorrelationType;
}

export type CorrelationType = 
  | 'EXPLICIT_REFERENCE'
  | 'NAMING_CONVENTION'
  | 'CLASS_RELATIONSHIP'
  | 'IMPORT_ANALYSIS'
  | 'COPILOT_INFERENCE';

export type TestFramework = 
  | 'junit4' | 'junit5' | 'testng'
  | 'jest' | 'mocha' | 'vitest'
  | 'pytest' | 'unittest';

export interface AnalysisResult {
  pair: TestSourcePair;
  testExpectation: Expectation;
  codeBehavior: Behavior;
  divergence: Divergence | null;
  gitContext: GitContext;
}

export interface Expectation {
  description: string;
  value?: unknown;
  type?: string;
}

export interface Behavior {
  description: string;
  value?: unknown;
  type?: string;
}

export interface Divergence {
  type: 'VALUE_MISMATCH' | 'TYPE_MISMATCH' | 'EXCEPTION_MISMATCH' | 'BEHAVIOR_MISMATCH';
  expected: string;
  actual: string;
  semanticDiff: string;
}

export interface GitContext {
  testLastModified: Date;
  codeLastModified: Date;
  relevantCommit?: Commit;
}

export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export type VerdictType = 
  | 'CODE_BUG'
  | 'OUTDATED_TEST'
  | 'FLAKY_TEST'
  | 'ENVIRONMENT_ISSUE'
  | 'PASSED';

export interface Verdict {
  type: VerdictType;
  confidence: number;
  reason: string;
  explanation: string;
  recommendation: Recommendation;
}

export interface Recommendation {
  action: 'UPDATE_TEST' | 'FIX_CODE' | 'STABILIZE_TEST' | 'MOCK_SERVICE' | 'NONE';
  file: string;
  line: number;
  before?: string;
  after?: string;
  explanation: string;
}

export interface VerdictResult {
  method: SourceMethod;
  test: TestCase;
  analysis: AnalysisResult;
  verdict: Verdict;
}
```

---

## Phase 3: CLI Setup (Day 2)

### src/index.ts

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCommand } from './cli/commands/analyze.js';
import { initCommand } from './cli/commands/init.js';
import { version } from './version.js';

const program = new Command();

program
  .name('hambugsy')
  .description('🍔 Find the bug in your stack - Is your test wrong or your code?')
  .version(version);

program
  .command('analyze <path>')
  .description('Analyze source files for test/code issues')
  .option('-r, --recursive', 'Analyze directories recursively')
  .option('-f, --filter <type>', 'Filter: bugs, tests, all', 'all')
  .option('--format <fmt>', 'Output: console, json, markdown, github', 'console')
  .option('-v, --verbose', 'Verbose output')
  .option('--confidence <n>', 'Minimum confidence threshold', '0.7')
  .action(analyzeCommand);

program
  .command('init')
  .description('Initialize configuration file')
  .action(initCommand);

// Custom help
program.addHelpText('after', `
${chalk.yellow('Examples:')}
  $ hambugsy analyze ./src/OrderService.java
  $ hambugsy analyze ./src --recursive --format=json
  $ hambugsy analyze ./src --filter=bugs

${chalk.cyan('Documentation:')} https://hambugsy.dev
`);

program.parse();
```

### src/cli/commands/analyze.ts

```typescript
import ora from 'ora';
import chalk from 'chalk';
import { Orchestrator } from '../../core/orchestrator.js';
import { ConsoleReporter } from '../output/console.js';
import { JsonReporter } from '../output/json.js';
import type { VerdictResult } from '../../types.js';

interface AnalyzeOptions {
  recursive?: boolean;
  filter?: 'bugs' | 'tests' | 'all';
  format?: 'console' | 'json' | 'markdown' | 'github';
  verbose?: boolean;
  confidence?: string;
}

export async function analyzeCommand(
  path: string, 
  options: AnalyzeOptions
): Promise<void> {
  const spinner = ora('Initializing Hambugsy...').start();
  
  try {
    // Check prerequisites
    spinner.text = 'Checking GitHub Copilot CLI...';
    await checkCopilotCli();
    
    // Create orchestrator
    const orchestrator = new Orchestrator({
      confidenceThreshold: parseFloat(options.confidence || '0.7'),
      verbose: options.verbose || false,
    });
    
    // Discover files
    spinner.text = 'Discovering files...';
    const files = await orchestrator.discoverFiles(path, options.recursive);
    
    spinner.text = `Analyzing ${files.length} files...`;
    
    // Run analysis
    const results = await orchestrator.analyze(files, (progress) => {
      spinner.text = `Analyzing: ${progress.current}/${progress.total} - ${progress.file}`;
    });
    
    spinner.succeed('Analysis complete');
    
    // Filter results
    const filtered = filterResults(results, options.filter);
    
    // Output
    switch (options.format) {
      case 'json':
        console.log(new JsonReporter().format(filtered));
        break;
      case 'github':
        outputGitHubAnnotations(filtered);
        break;
      default:
        new ConsoleReporter().print(filtered);
    }
    
    // Exit code
    const hasBugs = filtered.some(r => r.verdict.type === 'CODE_BUG');
    process.exit(hasBugs ? 1 : 0);
    
  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(2);
  }
}

async function checkCopilotCli(): Promise<void> {
  const { execa } = await import('execa');
  try {
    await execa('gh', ['copilot', '--version']);
  } catch {
    throw new Error(
      'GitHub Copilot CLI not found.\n' +
      'Install: gh extension install github/gh-copilot'
    );
  }
}

function filterResults(
  results: VerdictResult[], 
  filter?: string
): VerdictResult[] {
  if (!filter || filter === 'all') return results;
  if (filter === 'bugs') {
    return results.filter(r => r.verdict.type === 'CODE_BUG');
  }
  if (filter === 'tests') {
    return results.filter(r => r.verdict.type === 'OUTDATED_TEST');
  }
  return results;
}

function outputGitHubAnnotations(results: VerdictResult[]): void {
  for (const result of results) {
    const level = result.verdict.type === 'CODE_BUG' ? 'error' : 'warning';
    const file = result.verdict.recommendation.file;
    const line = result.verdict.recommendation.line;
    const title = result.verdict.type.replace('_', ' ');
    const message = result.verdict.reason;
    
    console.log(`::${level} file=${file},line=${line},title=${title}::${message}`);
  }
}
```

---

## Phase 4: Copilot Bridge (Day 3-4)

### src/services/copilot.ts

```typescript
import { execa } from 'execa';
import PQueue from 'p-queue';

export class CopilotBridge {
  private queue: PQueue;
  
  constructor() {
    // Rate limit: 2 concurrent, max 5 per second
    this.queue = new PQueue({
      concurrency: 2,
      interval: 1000,
      intervalCap: 5,
    });
  }
  
  /**
   * Ask Copilot to explain code semantics
   */
  async explain(code: string, question: string): Promise<string> {
    return this.queue.add(async () => {
      const prompt = `${question}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
      
      const { stdout } = await execa('gh', [
        'copilot', 'explain', prompt
      ], {
        timeout: 30000,
      });
      
      return stdout;
    });
  }
  
  /**
   * Ask Copilot to analyze test expectations
   */
  async analyzeTestExpectation(testCode: string): Promise<{
    description: string;
    expectedValue?: string;
    expectedBehavior?: string;
  }> {
    const response = await this.explain(testCode, 
      'What does this test expect? What value or behavior is being asserted? ' +
      'Respond with just the expectation in plain language.'
    );
    
    return {
      description: response.trim(),
    };
  }
  
  /**
   * Ask Copilot to analyze code behavior
   */
  async analyzeCodeBehavior(code: string): Promise<{
    description: string;
    actualBehavior?: string;
  }> {
    const response = await this.explain(code,
      'What does this code actually do? What value does it return or what behavior does it produce? ' +
      'Respond with just the behavior in plain language.'
    );
    
    return {
      description: response.trim(),
    };
  }
  
  /**
   * Ask Copilot to explain divergence between test and code
   */
  async explainDivergence(
    testCode: string, 
    sourceCode: string,
    testExpectation: string,
    codeBehavior: string
  ): Promise<string> {
    const prompt = `
Test code:
\`\`\`
${testCode}
\`\`\`

Source code:
\`\`\`
${sourceCode}
\`\`\`

The test expects: ${testExpectation}
The code does: ${codeBehavior}

Explain why these don't match. What changed or what's wrong?
`;
    
    return this.explain('', prompt);
  }
  
  /**
   * Ask Copilot to suggest a fix
   */
  async suggestFix(context: {
    testCode: string;
    sourceCode: string;
    divergence: string;
    gitContext: string;
    isTestWrong: boolean;
  }): Promise<{
    file: 'test' | 'source';
    suggestion: string;
    explanation: string;
  }> {
    const { stdout } = await execa('gh', [
      'copilot', 'suggest', '-t', 'code',
      `Fix this ${context.isTestWrong ? 'test' : 'code'}:

Test:
${context.testCode}

Source:
${context.sourceCode}

Issue: ${context.divergence}
Git context: ${context.gitContext}

Provide the corrected code.`
    ]);
    
    return {
      file: context.isTestWrong ? 'test' : 'source',
      suggestion: stdout,
      explanation: context.divergence,
    };
  }
}
```

---

## Phase 5: Parser Module (Day 4-6)

### src/parser/java/parser.ts

```typescript
import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import { readFile } from 'fs/promises';
import type { TestCase, SourceMethod, Assertion } from '../../types.js';

export class JavaParser {
  private parser: Parser;
  
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Java);
  }
  
  async parseFile(filePath: string): Promise<{
    tests: TestCase[];
    methods: SourceMethod[];
  }> {
    const content = await readFile(filePath, 'utf-8');
    const tree = this.parser.parse(content);
    
    const tests = this.extractTests(tree.rootNode, filePath, content);
    const methods = this.extractMethods(tree.rootNode, filePath, content);
    
    return { tests, methods };
  }
  
  private extractTests(
    root: Parser.SyntaxNode, 
    filePath: string,
    content: string
  ): TestCase[] {
    const tests: TestCase[] = [];
    
    // Find all method declarations
    const methods = this.findNodes(root, 'method_declaration');
    
    for (const method of methods) {
      // Check for @Test annotation
      const modifiers = method.childForFieldName('modifiers');
      if (!modifiers) continue;
      
      const hasTestAnnotation = this.findNodes(modifiers, 'marker_annotation')
        .some(a => a.text.includes('Test'));
      
      if (!hasTestAnnotation) continue;
      
      const name = method.childForFieldName('name')?.text || 'unknown';
      const body = method.childForFieldName('body');
      
      tests.push({
        name,
        filePath,
        lineNumber: method.startPosition.row + 1,
        endLine: method.endPosition.row + 1,
        framework: 'junit5',
        assertions: body ? this.extractAssertions(body) : [],
        body: body?.text || '',
      });
    }
    
    return tests;
  }
  
  private extractAssertions(body: Parser.SyntaxNode): Assertion[] {
    const assertions: Assertion[] = [];
    
    // Find method invocations that look like assertions
    const invocations = this.findNodes(body, 'method_invocation');
    
    for (const inv of invocations) {
      const methodName = inv.childForFieldName('name')?.text || '';
      
      if (methodName.startsWith('assert') || methodName.startsWith('expect')) {
        const args = inv.childForFieldName('arguments');
        
        assertions.push({
          type: this.getAssertionType(methodName),
          expected: args?.child(0)?.text || '',
          actual: args?.child(1)?.text,
          lineNumber: inv.startPosition.row + 1,
          raw: inv.text,
        });
      }
    }
    
    return assertions;
  }
  
  private extractMethods(
    root: Parser.SyntaxNode,
    filePath: string,
    content: string
  ): SourceMethod[] {
    const methods: SourceMethod[] = [];
    
    // Find class declarations
    const classes = this.findNodes(root, 'class_declaration');
    
    for (const cls of classes) {
      const className = cls.childForFieldName('name')?.text;
      const classBody = cls.childForFieldName('body');
      
      if (!classBody) continue;
      
      // Find methods in class
      const methodDecls = this.findNodes(classBody, 'method_declaration');
      
      for (const method of methodDecls) {
        // Skip test methods
        const modifiers = method.childForFieldName('modifiers');
        const isTest = modifiers && this.findNodes(modifiers, 'marker_annotation')
          .some(a => a.text.includes('Test'));
        
        if (isTest) continue;
        
        const name = method.childForFieldName('name')?.text || 'unknown';
        const params = this.extractParameters(method);
        const returnType = method.childForFieldName('type')?.text || 'void';
        const body = method.childForFieldName('body');
        
        methods.push({
          name,
          filePath,
          lineNumber: method.startPosition.row + 1,
          endLine: method.endPosition.row + 1,
          parameters: params,
          returnType,
          body: body?.text || '',
          className,
        });
      }
    }
    
    return methods;
  }
  
  private extractParameters(method: Parser.SyntaxNode): Array<{name: string; type: string}> {
    const params: Array<{name: string; type: string}> = [];
    const formalParams = method.childForFieldName('parameters');
    
    if (formalParams) {
      for (const param of formalParams.namedChildren) {
        if (param.type === 'formal_parameter') {
          const type = param.childForFieldName('type')?.text || 'Object';
          const name = param.childForFieldName('name')?.text || 'arg';
          params.push({ name, type });
        }
      }
    }
    
    return params;
  }
  
  private getAssertionType(methodName: string): Assertion['type'] {
    if (methodName.includes('Equal')) return 'equals';
    if (methodName.includes('Throw')) return 'throws';
    if (methodName.includes('True') || methodName.includes('False')) return 'truthy';
    if (methodName.includes('Contain')) return 'contains';
    return 'other';
  }
  
  private findNodes(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];
    
    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === type) {
        results.push(n);
      }
      for (const child of n.namedChildren) {
        traverse(child);
      }
    };
    
    traverse(node);
    return results;
  }
}
```

---

## Phase 6: Git Service (Day 6-7)

### src/services/git.ts

```typescript
import { execa } from 'execa';
import type { Commit } from '../types.js';

export class GitService {
  /**
   * Get commit history for a file
   */
  async getHistory(filePath: string, limit = 10): Promise<Commit[]> {
    const { stdout } = await execa('git', [
      'log',
      `-${limit}`,
      '--format=%H|%an|%ai|%s',
      '--',
      filePath,
    ]);
    
    if (!stdout.trim()) return [];
    
    return stdout.trim().split('\n').map(line => {
      const [hash, author, date, ...messageParts] = line.split('|');
      return {
        hash,
        author,
        date: new Date(date),
        message: messageParts.join('|'),
      };
    });
  }
  
  /**
   * Get blame information for specific lines
   */
  async blame(
    filePath: string, 
    startLine: number, 
    endLine: number
  ): Promise<Array<{ line: number; commit: Commit }>> {
    const { stdout } = await execa('git', [
      'blame',
      '-L', `${startLine},${endLine}`,
      '--line-porcelain',
      filePath,
    ]);
    
    const results: Array<{ line: number; commit: Commit }> = [];
    const lines = stdout.split('\n');
    
    let currentCommit: Partial<Commit> = {};
    let lineNum = startLine;
    
    for (const line of lines) {
      if (line.match(/^[a-f0-9]{40}/)) {
        currentCommit.hash = line.substring(0, 40);
      } else if (line.startsWith('author ')) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith('author-time ')) {
        currentCommit.date = new Date(parseInt(line.substring(12)) * 1000);
      } else if (line.startsWith('summary ')) {
        currentCommit.message = line.substring(8);
        
        results.push({
          line: lineNum++,
          commit: currentCommit as Commit,
        });
        currentCommit = {};
      }
    }
    
    return results;
  }
  
  /**
   * Check if a commit message indicates intentional change
   */
  isIntentionalChange(message: string): boolean {
    const intentionalPatterns = [
      /^feat:/i,
      /^feature:/i,
      /^refactor:/i,
      /update.*policy/i,
      /change.*logic/i,
      /new.*requirement/i,
      /\bticket[- ]?\d+/i,
      /\bjira[- ]?\d+/i,
      /\[.*\]/,  // [TICKET-123] style
    ];
    
    const accidentalPatterns = [
      /^fix:/i,
      /^bugfix:/i,
      /\bbug\b/i,
      /\btypo\b/i,
      /\boops\b/i,
      /\brevert\b/i,
      /\bhotfix\b/i,
    ];
    
    for (const pattern of accidentalPatterns) {
      if (pattern.test(message)) return false;
    }
    
    for (const pattern of intentionalPatterns) {
      if (pattern.test(message)) return true;
    }
    
    // Default: assume intentional if message is meaningful
    return message.length > 10;
  }
}
```

---

## Phase 7: Verdict Engine (Day 7-9)

### src/verdict/engine.ts

```typescript
import type { 
  AnalysisResult, 
  Verdict, 
  VerdictType, 
  Recommendation 
} from '../types.js';
import { GitService } from '../services/git.js';
import { CopilotBridge } from '../services/copilot.js';

export class VerdictEngine {
  constructor(
    private git: GitService,
    private copilot: CopilotBridge
  ) {}
  
  async determine(analysis: AnalysisResult): Promise<Verdict> {
    // No divergence = passed
    if (!analysis.divergence) {
      return {
        type: 'PASSED',
        confidence: 1.0,
        reason: 'Test passes',
        explanation: 'No issues detected',
        recommendation: {
          action: 'NONE',
          file: analysis.pair.test.filePath,
          line: analysis.pair.test.lineNumber,
          explanation: 'No action needed',
        },
      };
    }
    
    const { testLastModified, codeLastModified, relevantCommit } = analysis.gitContext;
    
    // Code changed after test?
    if (codeLastModified > testLastModified && relevantCommit) {
      const isIntentional = this.git.isIntentionalChange(relevantCommit.message);
      
      if (isIntentional) {
        // Intentional change = outdated test
        return this.createOutdatedTestVerdict(analysis);
      } else {
        // Accidental change = regression bug
        return this.createCodeBugVerdict(analysis, true);
      }
    }
    
    // Test is newer or same age = code bug
    return this.createCodeBugVerdict(analysis, false);
  }
  
  private async createOutdatedTestVerdict(
    analysis: AnalysisResult
  ): Promise<Verdict> {
    const { divergence, gitContext, pair } = analysis;
    
    // Ask Copilot for fix suggestion
    const fix = await this.copilot.suggestFix({
      testCode: pair.test.body,
      sourceCode: pair.source.body,
      divergence: divergence!.semanticDiff,
      gitContext: gitContext.relevantCommit?.message || '',
      isTestWrong: true,
    });
    
    return {
      type: 'OUTDATED_TEST',
      confidence: this.calculateConfidence(analysis, 'OUTDATED_TEST'),
      reason: `Code intentionally changed: "${gitContext.relevantCommit?.message}"`,
      explanation: `The test was written on ${gitContext.testLastModified.toDateString()} ` +
        `but the code was updated on ${gitContext.codeLastModified.toDateString()}. ` +
        `The commit message indicates this was an intentional change.`,
      recommendation: {
        action: 'UPDATE_TEST',
        file: pair.test.filePath,
        line: pair.test.lineNumber,
        before: this.extractAssertionLine(pair.test.body),
        after: fix.suggestion,
        explanation: fix.explanation,
      },
    };
  }
  
  private async createCodeBugVerdict(
    analysis: AnalysisResult,
    isRegression: boolean
  ): Promise<Verdict> {
    const { divergence, pair } = analysis;
    
    const fix = await this.copilot.suggestFix({
      testCode: pair.test.body,
      sourceCode: pair.source.body,
      divergence: divergence!.semanticDiff,
      gitContext: isRegression ? 'This appears to be a regression' : '',
      isTestWrong: false,
    });
    
    return {
      type: 'CODE_BUG',
      confidence: this.calculateConfidence(analysis, 'CODE_BUG'),
      reason: isRegression 
        ? 'Code change appears to be a regression'
        : 'Test expectation not met by implementation',
      explanation: `The test expects: ${analysis.testExpectation.description}\n` +
        `The code does: ${analysis.codeBehavior.description}`,
      recommendation: {
        action: 'FIX_CODE',
        file: pair.source.filePath,
        line: pair.source.lineNumber,
        before: this.extractRelevantCode(pair.source.body),
        after: fix.suggestion,
        explanation: fix.explanation,
      },
    };
  }
  
  private calculateConfidence(
    analysis: AnalysisResult, 
    verdictType: VerdictType
  ): number {
    let confidence = 0.7; // Base confidence
    
    // Boost for clear commit message
    if (analysis.gitContext.relevantCommit) {
      const msg = analysis.gitContext.relevantCommit.message;
      if (msg.match(/^(feat|fix|refactor):/i)) {
        confidence += 0.1;
      }
    }
    
    // Boost for strong correlation
    if (analysis.pair.confidence > 0.9) {
      confidence += 0.05;
    }
    
    // Boost for clear divergence
    if (analysis.divergence?.type === 'VALUE_MISMATCH') {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.99);
  }
  
  private extractAssertionLine(testBody: string): string {
    const match = testBody.match(/assert.*\(.*\)/i);
    return match ? match[0] : '';
  }
  
  private extractRelevantCode(sourceBody: string): string {
    // Extract return statement or key logic
    const returnMatch = sourceBody.match(/return.*?;/s);
    return returnMatch ? returnMatch[0] : sourceBody.slice(0, 100);
  }
}
```

---

## Phase 8: Console Reporter (Day 9-10)

### src/cli/output/console.ts

```typescript
import chalk from 'chalk';
import type { VerdictResult } from '../../types.js';

export class ConsoleReporter {
  print(results: VerdictResult[]): void {
    console.log('\n' + chalk.yellow.bold('🍔 HAMBUGSY') + ' - Finding the bug in your stack...\n');
    
    for (const result of results) {
      this.printResult(result);
      console.log('');
    }
    
    this.printSummary(results);
  }
  
  private printResult(result: VerdictResult): void {
    const { method, verdict, analysis } = result;
    
    // Header
    console.log(chalk.gray('┌' + '─'.repeat(65) + '┐'));
    console.log(chalk.gray('│  ') + 
      chalk.cyan(`📍 Method: ${method.name}()`) + 
      chalk.gray(` @ line ${method.lineNumber}`).padEnd(45) + 
      chalk.gray('│'));
    console.log(chalk.gray('├' + '─'.repeat(65) + '┤'));
    
    // Verdict icon
    const icon = this.getVerdictIcon(verdict.type);
    const color = this.getVerdictColor(verdict.type);
    
    console.log(chalk.gray('│  ') + 
      color(`${icon} VERDICT: ${verdict.type.replace('_', ' ')}`) +
      chalk.gray(` (${Math.round(verdict.confidence * 100)}%)`.padEnd(20)) +
      chalk.gray('│'));
    
    // Reason
    console.log(chalk.gray('│  '));
    const reasonLines = this.wrapText(verdict.reason, 60);
    for (const line of reasonLines) {
      console.log(chalk.gray('│  ') + line.padEnd(62) + chalk.gray('│'));
    }
    
    // Recommendation
    if (verdict.recommendation.action !== 'NONE') {
      console.log(chalk.gray('│  '));
      console.log(chalk.gray('│  ') + 
        chalk.green('💡 ' + verdict.recommendation.explanation.slice(0, 55)) + 
        chalk.gray('│'));
      
      if (verdict.recommendation.before && verdict.recommendation.after) {
        console.log(chalk.gray('│  ') + 
          chalk.red('  - ' + verdict.recommendation.before.slice(0, 55)) + 
          chalk.gray('│'));
        console.log(chalk.gray('│  ') + 
          chalk.green('  + ' + verdict.recommendation.after.slice(0, 55)) + 
          chalk.gray('│'));
      }
    }
    
    console.log(chalk.gray('└' + '─'.repeat(65) + '┘'));
  }
  
  private printSummary(results: VerdictResult[]): void {
    const bugs = results.filter(r => r.verdict.type === 'CODE_BUG').length;
    const outdated = results.filter(r => r.verdict.type === 'OUTDATED_TEST').length;
    const flaky = results.filter(r => r.verdict.type === 'FLAKY_TEST').length;
    const env = results.filter(r => r.verdict.type === 'ENVIRONMENT_ISSUE').length;
    const passed = results.filter(r => r.verdict.type === 'PASSED').length;
    
    console.log(chalk.gray('━'.repeat(67)));
    console.log(chalk.bold('📊 SUMMARY'));
    console.log(chalk.gray('━'.repeat(67)));
    console.log(`  Analyzed:         ${results.length} methods`);
    console.log(`  🐛 Code bugs:      ${bugs}`);
    console.log(`  📜 Outdated tests: ${outdated}`);
    console.log(`  🎲 Flaky tests:    ${flaky}`);
    console.log(`  🌐 Environment:    ${env}`);
    console.log(`  ✅ Passed:         ${passed}`);
    console.log('');
    console.log(`  Estimated time saved: ~${(bugs + outdated) * 30} minutes`);
    console.log(chalk.gray('━'.repeat(67)));
  }
  
  private getVerdictIcon(type: string): string {
    const icons: Record<string, string> = {
      CODE_BUG: '🐛',
      OUTDATED_TEST: '📜',
      FLAKY_TEST: '🎲',
      ENVIRONMENT_ISSUE: '🌐',
      PASSED: '✅',
    };
    return icons[type] || '❓';
  }
  
  private getVerdictColor(type: string): (s: string) => string {
    const colors: Record<string, (s: string) => string> = {
      CODE_BUG: chalk.red.bold,
      OUTDATED_TEST: chalk.yellow.bold,
      FLAKY_TEST: chalk.magenta.bold,
      ENVIRONMENT_ISSUE: chalk.cyan.bold,
      PASSED: chalk.green.bold,
    };
    return colors[type] || chalk.white;
  }
  
  private wrapText(text: string, width: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length > width) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    return lines;
  }
}
```

---

## Final Steps

### Day 10-11: Integration Testing
- Test with real Java/TypeScript projects
- Fix edge cases
- Optimize Copilot prompts

### Day 12-13: Documentation & Polish
- Write README
- Create demo video/GIF
- Polish CLI output

### Day 14: Submit to DEV.to
- Publish submission post
- Share on social media

---

## Commands Cheatsheet

```bash
# Development
npm run dev -- analyze ./fixtures/java
npm run dev -- analyze ./fixtures/typescript --verbose
npm test

# Build & Install globally
npm run build
npm link

# Use
hambugsy analyze ./src/OrderService.java
hambugsy analyze ./src --recursive --format=json
hambugsy init
```

---

## Success Criteria

- [ ] Analyzes Java/JUnit projects
- [ ] Analyzes TypeScript/Jest projects  
- [ ] Correctly identifies outdated tests vs code bugs
- [ ] Provides actionable fix recommendations
- [ ] Integrates with GitHub Actions
- [ ] Clean, memorable CLI output
- [ ] < 30 seconds for typical analysis
