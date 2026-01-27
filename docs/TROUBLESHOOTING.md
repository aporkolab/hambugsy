# Hambugsy Troubleshooting Guide

## Quick Diagnostics

```bash
# Check Hambugsy installation
hambugsy version

# Verify prerequisites
gh --version
gh copilot --version
git --version

# Validate configuration
hambugsy config validate

# Run with verbose output
hambugsy analyze ./src --verbose
```

---

## Common Issues

### 1. "GitHub Copilot CLI not found"

**Error:**
```
Error: GitHub Copilot CLI not found.
Install: gh extension install github/gh-copilot
```

**Cause:** GitHub Copilot CLI extension is not installed.

**Solution:**
```bash
# Install GitHub CLI (if needed)
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Windows
winget install --id GitHub.cli

# Then install Copilot extension
gh extension install github/gh-copilot

# Verify installation
gh copilot --version
```

---

### 2. "Not authenticated with GitHub"

**Error:**
```
Error: Not authenticated with GitHub.
Run: gh auth login
```

**Cause:** GitHub CLI is not authenticated.

**Solution:**
```bash
# Authenticate with GitHub
gh auth login

# Follow the prompts to authenticate via browser

# Verify authentication
gh auth status
```

---

### 3. "Copilot access denied"

**Error:**
```
Error: GitHub Copilot access denied.
Ensure you have an active Copilot subscription.
```

**Cause:** Your GitHub account doesn't have Copilot access.

**Solution:**
1. Check your [GitHub Copilot settings](https://github.com/settings/copilot)
2. Ensure you have an active subscription (individual, business, or via organization)
3. If part of an organization, ensure Copilot is enabled for your account

---

### 4. "Not a git repository"

**Error:**
```
Error: Not a git repository (or any parent up to mount point /)
```

**Cause:** Running Hambugsy outside a git repository.

**Solution:**
```bash
# Initialize git if needed
git init

# Or navigate to your repository
cd /path/to/your/repo

# Verify
git status
```

---

### 5. "No test files found"

**Error:**
```
Warning: No test files found matching patterns.
Analyzed: 0 files
```

**Cause:** Test file patterns don't match your project structure.

**Solution:**

1. Check your `.hambugsy.yml` patterns:
```yaml
patterns:
  test:
    - "test/**/*.java"           # Adjust to your structure
    - "**/*.test.ts"
    - "**/*Test.java"
```

2. Verify patterns match:
```bash
# List files that would match
find . -name "*.test.ts" -o -name "*Test.java"

# Or use glob expansion
ls test/**/*.java 2>/dev/null
```

3. Create config if missing:
```bash
hambugsy init
```

---

### 6. "Parse error" for a file

**Error:**
```
Error: Failed to parse src/MyService.java
  Line 45: Unexpected token '{'
```

**Cause:** Syntax error in source file or unsupported language feature.

**Solution:**

1. Check file for syntax errors:
```bash
# Java
javac -Xlint:all src/MyService.java

# TypeScript
npx tsc --noEmit src/MyService.ts

# Python
python -m py_compile src/my_service.py
```

2. Ensure file is valid for its language version
3. Report issue if file is valid but Hambugsy can't parse it

---

### 7. "Timeout during analysis"

**Error:**
```
Error: Analysis timeout for calculateDiscount()
  Exceeded 30000ms limit
```

**Cause:** Copilot CLI is taking too long to respond.

**Solution:**

1. Increase timeout in config:
```yaml
analysis:
  timeout_per_method: 60000  # 60 seconds

copilot:
  timeout: 60000
```

2. Reduce parallel analysis:
```bash
hambugsy analyze ./src --parallel=2
```

3. Check network connectivity

---

### 8. "Rate limit exceeded"

**Error:**
```
Error: GitHub API rate limit exceeded.
  Retry after: 2024-01-15T10:30:00Z
```

**Cause:** Too many Copilot requests in short time.

**Solution:**

1. Wait for rate limit to reset
2. Enable caching:
```yaml
cache:
  enabled: true
  ttl: 86400
```

3. Reduce parallel requests:
```bash
hambugsy analyze ./src --parallel=1
```

---

### 9. "Low confidence verdicts"

**Issue:** All verdicts have low confidence (< 70%).

**Cause:** Insufficient context for analysis.

**Solutions:**

1. Ensure git history is available:
```bash
# Check git log exists
git log --oneline -10

# If shallow clone, fetch full history
git fetch --unshallow
```

2. Lower threshold if appropriate:
```yaml
analysis:
  confidence_threshold: 0.5
```

3. Improve test naming conventions:
```java
// Good: Clear relationship to source method
@Test void testCalculateDiscount() { ... }

// Bad: Unclear relationship
@Test void test1() { ... }
```

---

### 10. "Incorrect verdict"

**Issue:** Hambugsy says "outdated test" but it's actually a code bug.

**Cause:** Git history or commit messages are misleading.

**Solutions:**

1. Check commit messages:
```bash
git log --oneline -10 -- path/to/file.java
```

2. Adjust verdict weights:
```yaml
weights:
  # Bias toward code bug (< 0.5)
  prefer_test_update: 0.3
  
  # Trust commit messages less
  trust_commit_message: 0.5
```

3. Add explicit patterns for your project:
```yaml
weights:
  intentional_commit_patterns:
    - "^feat:"
    - "JIRA-\\d+"
  
  accidental_commit_patterns:
    - "^fix:"
    - "WIP"
```

---

## Performance Issues

### Slow Analysis

**Symptoms:**
- Analysis takes > 5 minutes for small project
- High CPU usage

**Solutions:**

1. Enable caching:
```yaml
cache:
  enabled: true
  directory: "~/.cache/hambugsy"
```

2. Increase parallelism (if CPU available):
```bash
hambugsy analyze ./src --parallel=8
```

3. Exclude unnecessary files:
```yaml
ignore:
  files:
    - "**/node_modules/**"
    - "**/build/**"
    - "**/dist/**"
```

4. Use incremental analysis:
```bash
# Only analyze recently changed files
hambugsy analyze ./src --since="2024-01-01"
```

### High Memory Usage

**Symptoms:**
- Process killed by OOM
- System becomes sluggish

**Solutions:**

1. Reduce parallel analysis:
```bash
hambugsy analyze ./src --parallel=2
```

2. Limit files per run:
```yaml
analysis:
  max_methods_per_file: 30
```

3. Disable caching (uses less memory):
```bash
hambugsy analyze ./src --no-cache
```

---

## CI/CD Issues

### GitHub Actions Not Showing Annotations

**Problem:** Annotations not appearing on PR files.

**Solution:**

1. Ensure correct format:
```yaml
- run: hambugsy analyze ./src --format=github
```

2. Check workflow permissions:
```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write
```

3. Verify checkout includes history:
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history needed
```

### Exit Code Not Working

**Problem:** CI doesn't fail on code bugs.

**Solution:**

1. Check config:
```yaml
ci:
  fail_on_bugs: true
```

2. Verify exit codes:
```bash
hambugsy analyze ./src
echo "Exit code: $?"
# 0 = no issues, 1 = issues found
```

3. Use proper conditionals:
```yaml
- run: |
    hambugsy analyze ./src --format=github
    exit_code=$?
    if [ $exit_code -eq 1 ]; then
      echo "::error::Code bugs detected"
      exit 1
    fi
```

---

## Debug Mode

For detailed debugging information:

```bash
# Maximum verbosity
HAMBUGSY_LOGGING_LEVEL=debug hambugsy analyze ./src -v

# Save debug log to file
HAMBUGSY_LOGGING_FILE=./debug.log hambugsy analyze ./src

# Show what config is being used
hambugsy config show

# Show parsed AST (for parser issues)
hambugsy debug parse ./src/MyFile.java

# Show Copilot prompts being sent
hambugsy analyze ./src -v 2>&1 | grep "Copilot prompt"
```

---

## Getting Help

### Resources

- **Documentation:** [hambugsy.dev/docs](https://hambugsy.dev/docs)
- **GitHub Issues:** [github.com/APorkolab/hambugsy/issues](https://github.com/APorkolab/hambugsy/issues)
- **Discussions:** [github.com/APorkolab/hambugsy/discussions](https://github.com/APorkolab/hambugsy/discussions)
- **Discord:** [discord.gg/hambugsy](https://discord.gg/hambugsy)

### Filing a Bug Report

Include:
1. Hambugsy version (`hambugsy version --json`)
2. Operating system and version
3. Node.js version
4. Minimal reproduction steps
5. Expected vs actual behavior
6. Relevant configuration
7. Error messages (with `--verbose`)

```markdown
### Environment
- Hambugsy: 1.0.0
- OS: macOS 14.2
- Node: 20.10.0
- gh: 2.42.0

### Steps to Reproduce
1. Create file with code...
2. Run `hambugsy analyze ...`
3. See error

### Expected
Verdict should be "OUTDATED TEST"

### Actual
Got error: "Parse error on line 45"

### Configuration
```yaml
version: 1
patterns:
  source: ["src/**/*.java"]
```
```

---

## FAQ

**Q: Can I use Hambugsy without GitHub Copilot?**
A: Currently, no. Copilot CLI is the core AI engine. Support for other LLMs is planned.

**Q: Does Hambugsy send my code to the cloud?**
A: Code snippets are sent to GitHub Copilot for analysis, similar to using Copilot in your editor.

**Q: Why is my test marked as "outdated" when the code is wrong?**
A: Check your git history and commit messages. The verdict engine uses commit messages to determine intent.

**Q: Can I use Hambugsy with a private/enterprise GitHub?**
A: Yes, as long as `gh` CLI is configured for your GitHub instance and Copilot is available.

**Q: How do I exclude certain tests from analysis?**
A: Use the `ignore.tests` configuration option with glob patterns.
