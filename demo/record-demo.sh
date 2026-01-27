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
    sleep 0.02
  done
  echo
  sleep 0.3
}

# Run command - display shows "hambugsy" but executes node dist/index.js
run_hambugsy() {
  local args="$1"
  type_cmd "hambugsy $args"
  eval "$HAMBUGSY $args"
  sleep 1.5
}

clear

# Intro
echo "=========================================="
echo "  🍔 HAMBUGSY - Full Demo"
echo "  The CLI that tells you WHO is wrong:"
echo "  your test or your code!"
echo "=========================================="
sleep 2

clear

# 0. Show help menu
echo "# First, let's see what Hambugsy can do..."
sleep 1
run_hambugsy "--help"
sleep 2

clear

# 0b. Show version
echo "# Check the version..."
sleep 1
run_hambugsy "--version"
sleep 1

clear

# 1. Analyze Java - shows OUTDATED TEST detection
echo "# Analyze Java tests - detects OUTDATED tests!"
sleep 1
run_hambugsy "analyze test/fixtures/java"
sleep 3

clear

# 2. Suggest missing tests
echo "# Find MISSING test coverage..."
sleep 1
run_hambugsy "suggest test/fixtures/java/OrderService.java"
sleep 3

clear

# 3. Fix command (dry-run)
echo "# Auto-fix outdated tests (dry-run preview)..."
sleep 1
run_hambugsy "fix test/fixtures/java --dry-run --yes"
sleep 3

clear

# 4. Analyze TypeScript
echo "# Works with TypeScript too..."
sleep 1
run_hambugsy "analyze test/fixtures/typescript"
sleep 3

clear

# 5. JSON output for CI/CD
echo "# JSON output for CI/CD integration..."
sleep 1
type_cmd "hambugsy analyze test/fixtures/java --format=json | head -25"
eval "$HAMBUGSY analyze test/fixtures/java --format=json | head -25"
sleep 2

clear

# 6. GitHub Actions format
echo "# GitHub Actions annotations..."
sleep 1
run_hambugsy "analyze test/fixtures/java --format=github"
sleep 2

clear

# Outro
echo "=========================================="
echo "  🍔 That's Hambugsy!"
echo ""
echo "  Install: npm install -g hambugsy"
echo "  GitHub:  github.com/APorkolab/hambugsy"
echo ""
echo "  Finding the bug in your stack!"
echo "=========================================="
sleep 3
