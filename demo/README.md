# Hambugsy Demo

This folder contains a demo project with **intentional bugs** to showcase hambugsy's capabilities.

## The Bugs

The `discount-service.ts` has two bugs:

1. **Premium Discount Bug**: Documentation says 10%, code applies 15%
2. **Bulk Discount Bug**: Should trigger at 10+ items, triggers at 5+

## Run the Failing Tests

```bash
# See the tests fail
npx vitest run demo/

# Expected output: 3 tests fail
```

## Analyze with Hambugsy

```bash
# Analyze the demo folder
npx hambugsy analyze demo/

# Watch mode - re-analyzes on file changes
npx hambugsy analyze demo/ --watch
```

## Expected Results

Hambugsy should detect:
- `calculateDiscount` has CODE_BUG (premium discount wrong)
- `calculateDiscount` has CODE_BUG (bulk threshold wrong)
- Tests are correct, code is buggy
