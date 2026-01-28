# Hambugsy Demo

This folder contains demo materials for showcasing Hambugsy's capabilities.

## Watch the Demo

[![asciicast](https://asciinema.org/a/hZgtfHSLYVLY2kvL.svg)](https://asciinema.org/a/hZgtfHSLYVLY2kvL)

## Demo Contents

- `record-demo.sh` - Script to record the demo with asciinema
- `hambugsy-demo.cast` - The recorded demo file
- `discount-service.ts` - TypeScript example with intentional bugs
- `discount-service.test.ts` - Tests for the discount service

## Demo Features Showcased

1. **Help Menu** - `hambugsy --help` shows all available commands
2. **Version** - `hambugsy --version` displays current version
3. **Analyze** - Detects OUTDATED tests in Java fixtures
4. **Suggest** - Finds missing test coverage and generates suggestions
5. **Fix** - Auto-fix outdated tests (dry-run preview)
6. **Multi-language** - Works with TypeScript too
7. **CI/CD Integration** - JSON and GitHub Actions output formats

## Recording a New Demo

```bash
# Record with asciinema
asciinema rec -c "./demo/record-demo.sh" demo/hambugsy-demo.cast

# Upload to asciinema.org
asciinema upload demo/hambugsy-demo.cast
```

## Test Fixtures

The demo uses test fixtures from `test/fixtures/`:

### Java (`test/fixtures/java/`)
- `OrderService.java` - Has intentional discount constant mismatches
- `OrderServiceTest.java` - Tests with outdated assertions

### TypeScript (`test/fixtures/typescript/`)
- `calculator.ts` - Calculator implementation
- `calculator.test.ts` - Comprehensive test suite

## The Intentional Bugs

### Java OrderService
The `OrderService.java` has discount constants that don't match what the tests expect:
- Test expects 10% premium discount, code has 5%
- Test expects 5% standard discount, code has 15%

This demonstrates Hambugsy's ability to detect OUTDATED TESTS.
