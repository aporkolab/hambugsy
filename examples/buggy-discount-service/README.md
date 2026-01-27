# Buggy Discount Service Example

This example project demonstrates how **Hambugsy** detects mismatches between tests and code.

## The Bug

The `DiscountService` was updated to give premium members a **15% discount** instead of the original **10% discount**. However, the test file was **not updated** to reflect this change.

### Before (what the test expects):
```java
PREMIUM_DISCOUNT = 0.10  // 10% discount
// Test expects: 100.0 * 0.90 = 90.0
```

### After (what the code does):
```java
PREMIUM_DISCOUNT = 0.15  // 15% discount
// Code returns: 100.0 * 0.85 = 85.0
```

## Running Hambugsy

From this directory, run:

```bash
# Analyze the code
hambugsy analyze .

# Or with verbose output
hambugsy analyze . --verbose
```

## Expected Output

Hambugsy should detect:

1. **OUTDATED TEST** for `testPremiumDiscount`
   - Test expects: 90.0 (10% discount)
   - Code returns: 85.0 (15% discount)
   - Recommendation: Update test to expect 85.0

2. **OUTDATED TEST** for `testPremiumDiscountAmount`
   - Test expects: 10.0 (10% of 100)
   - Code returns: 15.0 (15% of 100)
   - Recommendation: Update test to expect 15.0

## Why This Matters

This is a common real-world scenario:
- A business decision was made to increase the premium discount
- A developer updated the code
- The tests were not updated
- CI passes because there are no test runs yet
- **Hambugsy catches this before it becomes a problem!**
