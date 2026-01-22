# 🍔 HAMBUGSY

## The CLI That Tells You WHO Is Wrong

---

## THE PROBLEM

Every developer knows this moment:

```
❌ FAILED: testCalculateDiscount
   Expected: 90
   Actual: 85
```

**Now you spend 45 minutes asking:**
- Did the business logic change?
- Is my test outdated?
- Is this a regression?
- Which file do I fix?

**Average time wasted: 30-60 minutes per failing test**

---

## THE SOLUTION

```bash
$ hambugsy analyze ./src/OrderService.java

🍔 HAMBUGSY

📍 calculateTotal() - line 47
├── ❌ Test FAILS: testCalculateTotal_WithDiscount  
├── 🔬 Analysis:
│   • Test expects: 10% discount (written: March 2024)
│   • Code applies: 15% discount (changed: November 2024)
│   • Git: "feat: update discount per new pricing policy"
│
└── 🎯 VERDICT: Code CHANGED → Test OUTDATED
    └── 💡 Fix: Update assertion line 23: 90 → 85

⏱️ Time saved: ~45 minutes
```

**Hambugsy gives you a verdict in under 30 seconds.**

---

## HOW IT WORKS

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Parse      │ ──▶ │  Analyze    │ ──▶ │  Verdict    │
│  Test+Code  │     │  with AI    │     │  + Fix      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   tree-sitter       GitHub Copilot        Git history
                         CLI               integration
```

1. **Parse** your test and source code
2. **Analyze** intent using GitHub Copilot CLI
3. **Compare** with git history
4. **Deliver** a verdict with fix recommendation

---

## FOUR VERDICTS

| Verdict | Icon | Meaning |
|---------|------|---------|
| **Code Bug** | 🐛 | Test correct, code broken |
| **Outdated Test** | 📜 | Code changed, update test |
| **Flaky Test** | 🎲 | Intermittent, needs stabilizing |
| **Environment** | 🌐 | External dependency issue |

---

## SUPPORTED LANGUAGES

| Language | Frameworks | Status |
|----------|------------|--------|
| Java | JUnit 4/5, TestNG | ✅ |
| TypeScript | Jest, Mocha, Vitest | ✅ |
| Python | pytest, unittest | ✅ |
| C# | NUnit, xUnit | 🔶 Beta |
| Go | testing | 🔶 Beta |

---

## QUICK START

```bash
# 1. Prerequisites
gh extension install github/gh-copilot

# 2. Install
npm install -g hambugsy

# 3. Analyze
hambugsy analyze ./src
```

---

## CI/CD INTEGRATION

```yaml
# GitHub Actions
- name: Analyze Test Failures
  run: hambugsy analyze ./src --format=github
```

Output appears as annotations directly on your PR.

---

## WHY "HAMBUGSY"?

🍔 **Ham** - Layers (like test layer, code layer)
🐛 **Bug** - What we're hunting  
🎩 **Bugsy** - The gangster who finds the guilty party

*"Finding the bug in your stack"*

---

## KEY DIFFERENTIATORS

| Others Say | Hambugsy Says |
|------------|---------------|
| "Test failed" | "Test is **outdated** because code changed" |
| "Expected X, got Y" | "Test expects 10% discount, code applies 15%" |
| "Automation bug" | "**Fix line 23**: change 90 to 85" |

---

## BUILT FOR THE CHALLENGE

🏆 **GitHub Copilot CLI Challenge**  
📅 Deadline: February 15, 2026

**Built with:**
- GitHub Copilot CLI (core AI engine)
- Tree-sitter (parsing)
- Git (history analysis)

---

## LINKS

🌐 **Website:** [hambugsy.dev](https://hambugsy.dev)  
📦 **GitHub:** [github.com/hambugsy/hambugsy](https://github.com/hambugsy/hambugsy)  
📖 **Docs:** [hambugsy.dev/docs](https://hambugsy.dev/docs)

---

## TAGLINE

> **Stop blaming. Start fixing.** 🍔

---

*Created by Ádám Porkoláb*  
*Senior Full-Stack Engineer | Author | Problem Solver*
