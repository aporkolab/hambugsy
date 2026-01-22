# 🍔 Hambugsy

**The CLI tool that tells you WHO is wrong: your test or your code.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with GitHub Copilot CLI](https://img.shields.io/badge/Built%20with-GitHub%20Copilot%20CLI-blue)](https://github.com/github/gh-copilot)

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

🍔 HAMBUGSY - Finding the bug in your stack...

┌─────────────────────────────────────────────────────────────────┐
│  📍 calculateTotal() - line 47                                  │
│  ├── ❌ Test FAILS: testCalculateTotal_WithDiscount             │
│  ├── 🔬 Analysis:                                               │
│  │   • Test expects: 10% discount (written: 2024-03-15)         │
│  │   • Code applies: 15% discount (changed: 2024-11-22)         │
│  │   • Git blame: "Updated discount per new pricing policy"     │
│  │                                                              │
│  └── 🎯 VERDICT: Code CHANGED → Test OUTDATED                   │
│      └── 💡 Fix: Update test assertion line 23: 90 → 85         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📍 validateOrder() - line 82                                   │
│  ├── ❌ Test FAILS: testValidateOrder_EmptyCart                 │
│  ├── 🔬 Analysis:                                               │
│  │   • Test expects: throw ValidationException                  │
│  │   • Code does: returns null (no null check)                  │
│  │   • No recent changes to this method                         │
│  │                                                              │
│  └── 🎯 VERDICT: Test CORRECT → Code has BUG                    │
│      └── 💡 Fix: Add null check before line 84                  │
└─────────────────────────────────────────────────────────────────┘

📊 Summary: 1 outdated test, 1 code bug | Time saved: ~45 minutes
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

```bash
# Prerequisites
gh extension install github/gh-copilot

# Install Hambugsy
npm install -g hambugsy

# Or clone and build
git clone https://github.com/yourusername/hambugsy.git
cd hambugsy
npm install && npm link
```

---

## Usage

### Basic Analysis

```bash
# Analyze a specific file
hambugsy analyze ./src/MyService.java

# Analyze with verbose output
hambugsy analyze ./src/MyService.java --verbose

# Analyze entire project
hambugsy analyze ./src --recursive
```

### Filtering

```bash
# Only show code bugs (ignore outdated tests)
hambugsy analyze ./src --filter=bugs

# Only show outdated tests
hambugsy analyze ./src --filter=tests

# Focus on specific test
hambugsy analyze ./src/MyService.java --test=testCalculateDiscount
```

### Output Formats

```bash
# JSON output for CI/CD integration
hambugsy analyze ./src --format=json

# Markdown report
hambugsy analyze ./src --format=markdown > report.md

# GitHub Actions annotation format
hambugsy analyze ./src --format=github
```

### Interactive Mode

```bash
# Step through each issue interactively
hambugsy analyze ./src --interactive

# Auto-fix with confirmation
hambugsy fix ./src
```

---

## Supported Languages

| Language | Test Frameworks | Status |
|----------|-----------------|--------|
| Java | JUnit 4/5, TestNG | ✅ Full |
| TypeScript/JavaScript | Jest, Mocha, Vitest | ✅ Full |
| Python | pytest, unittest | ✅ Full |
| C# | NUnit, xUnit, MSTest | 🔶 Beta |
| Go | testing package | 🔶 Beta |
| Kotlin | JUnit, Kotest | 📋 Planned |
| Rust | built-in tests | 📋 Planned |

---

## Configuration

Create `.hambugsy.yml` in your project root:

```yaml
# .hambugsy.yml
version: 1

# Source and test file patterns
patterns:
  source:
    - "src/**/*.java"
    - "src/**/*.ts"
  test:
    - "test/**/*.java"
    - "**/*.test.ts"
    - "**/*.spec.ts"

# Analysis settings
analysis:
  # How far back to check git history
  git_history_days: 90
  
  # Confidence threshold for verdicts (0.0 - 1.0)
  confidence_threshold: 0.7
  
  # Include AI explanation in output
  explain: true

# Ignore patterns
ignore:
  - "**/generated/**"
  - "**/node_modules/**"
  - "**/*.mock.ts"

# CI/CD settings
ci:
  # Fail build if code bugs found
  fail_on_bugs: true
  
  # Fail build if outdated tests found
  fail_on_outdated_tests: false
  
  # Generate report artifact
  report: true
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
      
      - name: Install Hambugsy
        run: npm install -g hambugsy
      
      - name: Run Analysis
        run: hambugsy analyze ./src --format=github
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

```yaml
hambugsy:
  stage: test
  script:
    - npm install -g hambugsy
    - hambugsy analyze ./src --format=json > hambugsy-report.json
  artifacts:
    reports:
      hambugsy: hambugsy-report.json
```

---

## The Verdict System

Hambugsy classifies every failing test into one of four verdicts:

| Verdict | Meaning | Icon |
|---------|---------|------|
| **Code Bug** | Test is correct, code has a defect | 🐛 |
| **Outdated Test** | Code changed, test needs update | 📜 |
| **Flaky Test** | Test passes/fails inconsistently | 🎲 |
| **Environment Issue** | External dependency problem | 🌐 |

---

## 🆕 Missing Test Suggestions

Beyond analyzing failing tests, Hambugsy proactively identifies **untested code paths**:

```bash
$ hambugsy suggest ./src/OrderService.java

🍔 HAMBUGSY - Finding gaps in your test coverage...

┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  MISSING TESTS DETECTED                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📍 validateOrder() @ line 42                                   │
│  ├── ❌ No test for: null input handling                        │
│  ├── ❌ No test for: empty cart scenario                        │
│  └── ❌ No test for: negative quantity values                   │
│                                                                 │
│  💡 SUGGESTED TESTS:                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @Test                                                      │ │
│  │ void validateOrder_ShouldThrow_WhenCartIsNull() {          │ │
│  │     assertThrows(ValidationException.class,                │ │
│  │         () -> service.validateOrder(null));                │ │
│  │ }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📍 processPayment() @ line 78                                  │
│  ├── ✅ Happy path tested                                       │
│  ├── ❌ No test for: payment gateway timeout                    │
│  └── ❌ No test for: insufficient funds scenario                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

📊 Coverage Gap Summary:
   Methods without tests: 2/8
   Missing edge cases: 7
   Suggested new tests: 5
```

### How It Works

1. **Static Analysis** - Identifies all public methods and their parameters
2. **Pattern Detection** - Recognizes common scenarios that need testing:
   - Null/undefined inputs
   - Empty collections
   - Boundary values (0, -1, MAX_INT)
   - Exception paths
   - Async error handling
3. **AI Generation** - Uses Copilot to generate actual test code suggestions
4. **Priority Ranking** - Orders suggestions by risk (null checks > edge cases)

### How Verdicts Are Determined

```
                    ┌─────────────────────┐
                    │  Test Failure Found │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Did code change     │
              ┌─YES─┤ since test written? ├─NO──┐
              │     └─────────────────────┘     │
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │ Does new code   │               │ Does test match │
    │ match business  │               │ requirements?   │
    │ requirements?   │               └────────┬────────┘
    └────────┬────────┘                        │
             │                          ┌──────┴──────┐
      ┌──────┴──────┐                   │             │
      │             │                  YES            NO
     YES            NO                  │             │
      │             │                   ▼             ▼
      ▼             ▼              ┌─────────┐   ┌─────────┐
 ┌─────────┐   ┌─────────┐        │Code Bug │   │Test Bug │
 │Outdated │   │Code Bug │        └─────────┘   └─────────┘
 │  Test   │   │(regress)│
 └─────────┘   └─────────┘
```

---

## Examples

### Example 1: Outdated Test After Business Logic Change

```java
// OrderService.java - Updated 2024-11-22
public double calculateDiscount(double price, boolean isPremium) {
    return isPremium ? price * 0.15 : price * 0.05;  // Changed from 10%/3%
}

// OrderServiceTest.java - Written 2024-03-15  
@Test
void testPremiumDiscount() {
    assertEquals(10.0, service.calculateDiscount(100, true));  // Expects 10%
}
```

```bash
$ hambugsy analyze ./src/OrderService.java

🎯 VERDICT: Code CHANGED → Test OUTDATED

Timeline:
  • 2024-03-15: Test written expecting 10% premium discount
  • 2024-11-22: Code updated to 15% per "new pricing policy" (commit a1b2c3d)

💡 Recommended fix:
   OrderServiceTest.java:15 - Change assertion from 10.0 to 15.0
```

### Example 2: Actual Code Bug

```typescript
// userService.ts
async function getUser(id: string): Promise<User> {
    const user = await db.users.findById(id);
    return user;  // Missing null check!
}

// userService.test.ts
it('should throw when user not found', async () => {
    await expect(getUser('invalid-id')).rejects.toThrow(UserNotFoundError);
});
```

```bash
$ hambugsy analyze ./src/userService.ts

🎯 VERDICT: Test CORRECT → Code has BUG

Analysis:
  • Test expects: UserNotFoundError when user not found
  • Code does: Returns undefined (no error thrown)
  • No recent changes to this method
  • Similar pattern exists in ProductService.getProduct() (working correctly)

💡 Recommended fix:
   userService.ts:4 - Add null check:
   if (!user) throw new UserNotFoundError(id);
```

---

## Why "Hambugsy"?

**Ham** + **Bug** + **Bugsy** (the gangster)

- 🍔 **Ham** - Like a hamburger with layers (test layer, code layer)
- 🐛 **Bug** - What we're hunting
- 🎩 **Bugsy** - Like Bugsy Siegel, we find who's guilty

*"Finding the bug in your stack"* - because bugs hide between layers, just like in a hamburger.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Development setup
git clone https://github.com/yourusername/hambugsy.git
cd hambugsy
npm install
npm run dev

# Run tests
npm test

# Build
npm run build
```

---

## Roadmap

- [x] Core verdict engine
- [x] Java/JUnit support
- [x] TypeScript/Jest support
- [x] Git history analysis
- [ ] VS Code extension
- [ ] IntelliJ plugin
- [ ] Auto-fix mode
- [ ] Team analytics dashboard
- [ ] Slack/Teams notifications

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
