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
echo "# What can Hambugsy do?"
sleep 1
run_hambugsy "--help"
sleep 3

clear

# 2. Analyze Java files
echo "# Analyze Java test files..."
sleep 1
run_hambugsy "analyze test/fixtures/java"
sleep 4

clear

# 3. Analyze TypeScript files
echo "# Works with TypeScript too..."
sleep 1
run_hambugsy "analyze test/fixtures/typescript --filter=all"
sleep 4

clear

# 4. Suggest missing tests
echo "# Find missing test coverage..."
sleep 1
run_hambugsy "suggest test/fixtures/java/OrderService.java"
sleep 4

clear

# 5. JSON output for CI/CD
echo "# JSON output for CI/CD integration..."
sleep 1
type_cmd "hambugsy analyze test/fixtures/java --format=json | head -30"
eval "$HAMBUGSY analyze test/fixtures/java --format=json | head -30"
sleep 3

clear

# 6. GitHub Actions format
echo "# GitHub Actions annotations..."
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
sleep 4
