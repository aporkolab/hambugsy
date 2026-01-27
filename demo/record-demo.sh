#!/bin/bash
# Hambugsy Full Demo Script
# Run with: asciinema rec -c "./demo/record-demo.sh" demo.cast

# Force colors in output
export FORCE_COLOR=1

# Use local build
HAMBUGSY="node dist/index.js"

# Helper to type with realistic delays
type_cmd() {
  local display_cmd="$1"
  echo -n "$ "
  echo "$display_cmd" | while IFS= read -r -n1 char; do
    echo -n "$char"
    sleep 0.03
  done
  echo
  sleep 0.5
}

# Run command - display shows "hambugsy" but executes node dist/index.js
run_hambugsy() {
  local args="$1"
  type_cmd "hambugsy $args"
  eval "$HAMBUGSY $args"
  sleep 2
}

run_cmd() {
  type_cmd "$1"
  eval "$1"
  sleep 2
}

clear

# Intro
echo "=========================================="
echo "  HAMBUGSY - Full Demo"
echo "  The CLI that tells you WHO is wrong:"
echo "  your test or your code!"
echo "=========================================="
sleep 3

clear

# 1. Show help
echo "# First, let's see what Hambugsy can do..."
sleep 1
run_hambugsy "--help"
sleep 3

clear

# 2. Analyze Java files
echo "# Analyze Java test files to detect issues..."
sleep 1
run_hambugsy "analyze test/fixtures/java"
sleep 4

clear

# 3. Analyze TypeScript files
echo "# Works with TypeScript/JavaScript too..."
sleep 1
run_hambugsy "analyze test/fixtures/typescript"
sleep 4

clear

# 4. Analyze Python files
echo "# And Python projects..."
sleep 1
run_hambugsy "analyze test/fixtures/python"
sleep 4

clear

# 5. Run with --run-tests flag
echo "# NEW: Run actual tests for real failure detection..."
sleep 1
run_hambugsy "analyze test/fixtures/typescript --run-tests"
sleep 4

clear

# 6. Suggest missing tests
echo "# Find missing test coverage..."
sleep 1
run_hambugsy "suggest test/fixtures/java/OrderService.java"
sleep 4

clear

# 7. JSON output for CI/CD
echo "# JSON output for CI/CD integration..."
sleep 1
type_cmd "hambugsy analyze test/fixtures/java --format=json | head -50"
eval "$HAMBUGSY analyze test/fixtures/java --format=json | head -50"
sleep 3

clear

# 8. Markdown output
echo "# Markdown output for documentation..."
sleep 1
type_cmd "hambugsy analyze test/fixtures/java --format=markdown | head -40"
eval "$HAMBUGSY analyze test/fixtures/java --format=markdown | head -40"
sleep 3

clear

# 9. Fix command (dry-run)
echo "# Auto-fix detected issues (dry-run mode)..."
sleep 1
run_hambugsy "fix test/fixtures --dry-run --yes"
sleep 3

clear

# 10. GitHub Actions format
echo "# GitHub Actions annotations format..."
sleep 1
run_hambugsy "analyze test/fixtures/java --format=github"
sleep 3

clear

# Outro
echo "=========================================="
echo "  That's Hambugsy!"
echo ""
echo "  Install: npm install -g hambugsy"
echo "  GitHub:  github.com/APorkolab/hambugsy"
echo ""
echo "  Finding the bug in your stack!"
echo "=========================================="
sleep 5
