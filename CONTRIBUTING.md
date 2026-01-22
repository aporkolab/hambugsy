# Contributing to Hambugsy

First off, thanks for taking the time to contribute! 🍔

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Testing](#testing)

---

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming environment. Be respectful, constructive, and collaborative.

**Our Standards:**
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

---

## Getting Started

### Prerequisites

- Node.js 20+
- Git
- GitHub CLI with Copilot extension (`gh extension install github/gh-copilot`)
- A GitHub account with Copilot access

### Quick Start

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/hambugsy.git
cd hambugsy
npm install
npm run dev -- analyze ./fixtures/java
```

---

## Development Setup

### Install Dependencies

```bash
npm install
```

### Project Structure

```
hambugsy/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── cli/               # Command handlers
│   ├── core/              # Business logic
│   ├── parser/            # Language parsers
│   ├── services/          # External integrations
│   └── utils/             # Helpers
├── test/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data
└── docs/                  # Documentation
```

### Development Commands

```bash
# Run in development mode
npm run dev -- analyze ./path/to/file

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

---

## How to Contribute

### Reporting Bugs

**Before submitting a bug report:**
1. Check the [issue tracker](https://github.com/hambugsy/hambugsy/issues) for existing reports
2. Ensure you're using the latest version
3. Collect relevant information (OS, Node version, error messages)

**Bug Report Template:**

```markdown
### Description
A clear description of the bug.

### To Reproduce
1. Run `hambugsy analyze ...`
2. See error

### Expected Behavior
What you expected to happen.

### Environment
- OS: [e.g., macOS 14.0]
- Node: [e.g., 20.10.0]
- Hambugsy: [e.g., 1.0.0]

### Additional Context
Any other relevant information.
```

### Suggesting Features

We love feature suggestions! Please include:
- Clear use case (why is this needed?)
- Proposed solution
- Alternatives you've considered

### Adding Language Support

Want to add support for a new language? Here's how:

1. **Create Parser** in `src/parser/[language]/`
   ```typescript
   // src/parser/rust/parser.ts
   export class RustParser implements LanguageParser {
     // Implement interface
   }
   ```

2. **Add Test Framework Support** in `src/parser/[language]/[framework].ts`
   ```typescript
   // src/parser/rust/cargo-test.ts
   export class CargoTestParser {
     // Parse #[test] functions
   }
   ```

3. **Register Parser** in `src/parser/index.ts`
   ```typescript
   import { RustParser } from './rust/parser.js';
   
   export const parsers = {
     // ...existing parsers
     rust: new RustParser(),
   };
   ```

4. **Add Test Fixtures** in `test/fixtures/[language]/`

5. **Write Tests** in `test/unit/parser/[language].test.ts`

6. **Update Documentation**

---

## Pull Request Process

### Before Submitting

1. **Create an issue first** for significant changes
2. **Fork the repo** and create a feature branch
3. **Write tests** for new functionality
4. **Update documentation** if needed
5. **Run the full test suite**

### Branch Naming

```
feature/add-rust-support
fix/null-pointer-in-analyzer
docs/update-readme
refactor/simplify-verdict-engine
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Rust language support
fix: handle null pointer in analyzer
docs: update installation instructions
refactor: simplify verdict decision tree
test: add integration tests for TypeScript parser
chore: update dependencies
```

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Types check (`npm run typecheck`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow convention
- [ ] PR description explains the change

### Review Process

1. A maintainer will review your PR
2. Address any requested changes
3. Once approved, a maintainer will merge
4. Your contribution will be in the next release!

---

## Style Guidelines

### TypeScript

```typescript
// Use explicit types for function signatures
function analyzeFile(path: string, options: AnalyzeOptions): Promise<Result> {
  // ...
}

// Prefer interfaces over types for objects
interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
}

// Use const for immutable values
const DEFAULT_CONFIDENCE = 0.7;

// Prefer async/await over .then()
async function processFiles(files: string[]): Promise<void> {
  for (const file of files) {
    await processFile(file);
  }
}

// Use early returns to reduce nesting
function getVerdict(analysis: Analysis): Verdict {
  if (!analysis.divergence) {
    return { type: 'PASSED' };
  }
  
  if (analysis.codeChanged && analysis.intentional) {
    return { type: 'OUTDATED_TEST' };
  }
  
  return { type: 'CODE_BUG' };
}
```

### File Organization

```typescript
// Order of imports
import { externalPackage } from 'external-package';  // 1. External
import { internalModule } from '../internal/index.js';  // 2. Internal
import type { TypeOnly } from '../types.js';  // 3. Types last

// Order within a file
// 1. Types/Interfaces
// 2. Constants
// 3. Helper functions (private)
// 4. Main exports (public)
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `verdict-engine.ts` |
| Classes | PascalCase | `VerdictEngine` |
| Functions | camelCase | `analyzeFile` |
| Constants | SCREAMING_SNAKE | `DEFAULT_TIMEOUT` |
| Types/Interfaces | PascalCase | `AnalysisResult` |

---

## Testing

### Unit Tests

```typescript
// test/unit/verdict/engine.test.ts
import { describe, it, expect } from 'vitest';
import { VerdictEngine } from '../../../src/verdict/engine.js';

describe('VerdictEngine', () => {
  describe('determine', () => {
    it('should return PASSED when no divergence', async () => {
      const engine = new VerdictEngine(mockGit, mockCopilot);
      const analysis = createMockAnalysis({ divergence: null });
      
      const verdict = await engine.determine(analysis);
      
      expect(verdict.type).toBe('PASSED');
    });
    
    it('should return OUTDATED_TEST when code intentionally changed', async () => {
      // ...
    });
  });
});
```

### Integration Tests

```typescript
// test/integration/java-junit.test.ts
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../../src/core/orchestrator.js';

describe('Java/JUnit Integration', () => {
  it('should detect outdated test in sample project', async () => {
    const orchestrator = new Orchestrator();
    const results = await orchestrator.analyze(['./fixtures/java/outdated-test/']);
    
    expect(results).toHaveLength(1);
    expect(results[0].verdict.type).toBe('OUTDATED_TEST');
  });
});
```

### Test Fixtures

Place test files in `test/fixtures/`:

```
test/fixtures/
├── java/
│   ├── outdated-test/
│   │   ├── src/OrderService.java
│   │   └── test/OrderServiceTest.java
│   └── code-bug/
│       ├── src/UserService.java
│       └── test/UserServiceTest.java
├── typescript/
│   ├── outdated-test/
│   └── code-bug/
└── python/
    └── ...
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- verdict-engine

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Questions?

- Open a [Discussion](https://github.com/hambugsy/hambugsy/discussions)
- Join our [Discord](https://discord.gg/hambugsy)
- Email: contributors@hambugsy.dev

Thank you for contributing! 🍔🐛
