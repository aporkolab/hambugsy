# Hambugsy Roadmap

## Vision

**Make "is my test wrong or my code wrong?" a solved problem for every developer.**

---

## Current Status: MVP

**Version 0.1.0** (Target: February 15, 2026 - Challenge Deadline)

### Core Features ✅

- [x] Java/JUnit parser
- [x] TypeScript/Jest parser
- [x] Python/pytest parser
- [x] GitHub Copilot CLI integration
- [x] Git history analysis
- [x] Verdict engine (4 verdicts)
- [x] **Missing Test Suggestions** (suggest command) 🆕
- [x] Console output
- [x] JSON output
- [x] GitHub Actions annotations
- [x] Basic configuration file

---

## Phase 1: Post-Challenge Polish

**Version 1.0.0** (Target: March 2026)

### Stability & Quality
- [ ] Comprehensive test suite (>80% coverage)
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Caching layer (reduce Copilot calls)

### Documentation
- [ ] Video tutorials
- [ ] API documentation
- [ ] Integration guides
- [ ] Best practices

### CI/CD
- [ ] GitLab CI support
- [ ] Azure DevOps support
- [ ] Jenkins plugin
- [ ] CircleCI orb

---

## Phase 2: IDE Integration

**Version 1.5.0** (Target: Q2 2026)

### VS Code Extension
- [ ] Inline verdict display
- [ ] One-click fix application
- [ ] Test/code navigation
- [ ] Gutter icons for verdicts

### IntelliJ Plugin
- [ ] IDEA support
- [ ] WebStorm support
- [ ] PyCharm support
- [ ] Android Studio support

### Features
- [ ] Watch mode (auto-analyze on save)
- [ ] Test file generation
- [ ] Refactoring suggestions

---

## Phase 3: Language Expansion

**Version 2.0.0** (Target: Q3 2026)

### New Languages
- [ ] Kotlin (Kotest, JUnit)
- [ ] Rust (cargo test)
- [ ] Go (testing package)
- [ ] C# (NUnit, xUnit, MSTest) - Full support
- [ ] Ruby (RSpec, Minitest)
- [ ] PHP (PHPUnit)
- [ ] Swift (XCTest)

### Framework Coverage
- [ ] TestNG (Java) - Full support
- [ ] Mocha (TypeScript/JS)
- [ ] Vitest (TypeScript/JS)
- [ ] unittest (Python)

---

## Phase 4: Team Features

**Version 2.5.0** (Target: Q4 2026)

### Analytics Dashboard
- [ ] Team-wide verdict statistics
- [ ] Trending issues
- [ ] Developer productivity metrics
- [ ] Code quality trends

### Collaboration
- [ ] Slack notifications
- [ ] Microsoft Teams integration
- [ ] Email reports
- [ ] Custom webhooks

### Team Configuration
- [ ] Shared verdict rules
- [ ] Custom patterns
- [ ] Organization-wide defaults

---

## Phase 5: Enterprise

**Version 3.0.0** (Target: 2027)

### Enterprise Features
- [ ] SSO/SAML integration
- [ ] Role-based access control
- [ ] Audit logging
- [ ] On-premise deployment option
- [ ] Air-gapped environments

### Advanced Analysis
- [ ] Historical trend analysis
- [ ] Predictive flaky test detection
- [ ] Test suite health scoring
- [ ] Technical debt quantification

### Compliance
- [ ] SOC 2 compliance
- [ ] GDPR compliance
- [ ] Data retention policies

---

## Future Exploration

### Auto-Fix Mode
- [ ] Automatic test updates (with confirmation)
- [ ] Automatic code fixes (with review)
- [ ] PR creation with fixes
- [ ] Batch fix operations

### AI Enhancements
- [ ] Custom LLM support (Ollama, local models)
- [ ] Fine-tuned verdict model
- [ ] Learning from corrections
- [ ] Natural language queries

### Integration Ecosystem
- [ ] Jira integration (link verdicts to tickets)
- [ ] Linear integration
- [ ] GitHub Issues automation
- [ ] PagerDuty integration

### Advanced Verdicts
- [ ] Root cause chains (A caused B caused C)
- [ ] Related failure grouping
- [ ] Similar pattern detection
- [ ] Cross-repo analysis

---

## Community Requests

*Features requested by users (voting system coming)*

| Feature | Votes | Status |
|---------|-------|--------|
| VS Code extension | 🔥🔥🔥 | Phase 2 |
| Monorepo support | 🔥🔥 | Backlog |
| Custom verdict rules | 🔥🔥 | Backlog |
| Offline mode | 🔥 | Exploring |
| Test generation | 🔥 | Exploring |

---

## Release Schedule

| Version | Target Date | Focus |
|---------|-------------|-------|
| 0.1.0 | Feb 15, 2026 | MVP (Challenge) |
| 1.0.0 | Mar 2026 | Stability |
| 1.5.0 | Q2 2026 | IDE Integration |
| 2.0.0 | Q3 2026 | Languages |
| 2.5.0 | Q4 2026 | Teams |
| 3.0.0 | 2027 | Enterprise |

---

## How to Influence the Roadmap

1. **GitHub Issues** - Feature requests and bug reports
2. **Discussions** - Community feedback
3. **Discord** - Real-time conversations
4. **Contribute** - PRs are welcome!

---

## Non-Goals

Things we're explicitly NOT building:

- ❌ Test runner (use JUnit, Jest, pytest)
- ❌ Test framework (use existing)
- ❌ Code coverage tool (use Istanbul, JaCoCo)
- ❌ Test management system (use TestRail, etc.)
- ❌ CI/CD platform (use GitHub Actions, etc.)

**We focus on one thing: answering "test or code?"**
