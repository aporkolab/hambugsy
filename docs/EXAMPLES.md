# Hambugsy Examples & Use Cases

## Real-World Scenarios

---

## Example 1: Business Logic Change (Outdated Test)

### Scenario
A discount policy was updated from 10% to 15%, but the tests weren't updated.

### Source Code (Updated)
```java
// OrderService.java - Last modified: 2024-11-22
// Commit: "feat: update premium discount to 15% per new pricing policy"

public class OrderService {
    
    public double calculateDiscount(double price, boolean isPremium) {
        if (isPremium) {
            return price * 0.15;  // Changed from 0.10
        }
        return price * 0.05;
    }
}
```

### Test Code (Outdated)
```java
// OrderServiceTest.java - Last modified: 2024-03-15
// Commit: "Add discount calculation tests"

public class OrderServiceTest {
    
    @Test
    void testPremiumDiscount() {
        OrderService service = new OrderService();
        double result = service.calculateDiscount(100.0, true);
        assertEquals(10.0, result);  // Expects 10%, but code does 15%
    }
}
```

### Hambugsy Analysis
```bash
$ hambugsy analyze ./src/OrderService.java

🍔 HAMBUGSY v1.0.0

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: calculateDiscount() @ line 5                        │
├─────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: testPremiumDiscount                           │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Test written: 2024-03-15 (8 months ago)                    │
│  ├── Code changed: 2024-11-22 (2 months ago)                    │
│  ├── Commit: "feat: update premium discount to 15%"             │
│  │                                                              │
│  ├── Test expects: return price * 0.10 (10% discount)           │
│  └── Code returns: return price * 0.15 (15% discount)           │
│                                                                 │
│  🎯 VERDICT: OUTDATED TEST (confidence: 96%)                    │
│                                                                 │
│  📝 EXPLANATION:                                                │
│  The code was intentionally updated to implement a new 15%      │
│  premium discount policy. The commit message "feat: update      │
│  premium discount to 15% per new pricing policy" indicates      │
│  this was a deliberate business logic change, not a bug.        │
│                                                                 │
│  💡 RECOMMENDATION:                                              │
│  Update test assertion in OrderServiceTest.java line 10:        │
│  - assertEquals(10.0, result);                                  │
│  + assertEquals(15.0, result);                                  │
│                                                                 │
│  Or if testing the percentage:                                  │
│  + // Verify 15% premium discount                               │
│  + assertEquals(15.0, result, "Premium discount should be 15%");│
└─────────────────────────────────────────────────────────────────┘
```

---

## Example 2: Missing Null Check (Code Bug)

### Scenario
A service method doesn't handle null input, but the test expects it to throw.

### Source Code (Buggy)
```typescript
// userService.ts

export async function getUser(id: string): Promise<User> {
    const user = await db.users.findById(id);
    return user;  // Bug: returns undefined if not found
}
```

### Test Code (Correct)
```typescript
// userService.test.ts

describe('getUser', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
        await expect(getUser('non-existent-id'))
            .rejects
            .toThrow(UserNotFoundError);
    });
});
```

### Hambugsy Analysis
```bash
$ hambugsy analyze ./src/userService.ts

🍔 HAMBUGSY v1.0.0

┌─────────────────────────────────────────────────────────────────┐
│  📍 Function: getUser() @ line 3                                │
├─────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: should throw UserNotFoundError                │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Test written: 2024-09-01                                   │
│  ├── Code last changed: 2024-09-01 (same day)                   │
│  ├── No intentional change detected                             │
│  │                                                              │
│  ├── Test expects: throw UserNotFoundError                      │
│  └── Code does: returns undefined (no error thrown)             │
│                                                                 │
│  🎯 VERDICT: CODE BUG (confidence: 91%)                         │
│                                                                 │
│  📝 EXPLANATION:                                                │
│  The test correctly expects a UserNotFoundError when            │
│  requesting a non-existent user. This is standard practice      │
│  for user lookup services. The implementation is missing        │
│  error handling for the "not found" case.                       │
│                                                                 │
│  Similar pattern found in:                                      │
│  - productService.ts:getProduct() (correctly throws)            │
│  - orderService.ts:getOrder() (correctly throws)                │
│                                                                 │
│  💡 RECOMMENDATION:                                              │
│  Add null check in userService.ts after line 4:                 │
│                                                                 │
│  export async function getUser(id: string): Promise<User> {     │
│      const user = await db.users.findById(id);                  │
│  +   if (!user) {                                               │
│  +       throw new UserNotFoundError(id);                       │
│  +   }                                                          │
│      return user;                                               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example 3: Flaky Test (Race Condition)

### Scenario
A test sometimes passes and sometimes fails due to async timing.

### Source Code
```typescript
// notificationService.ts

export class NotificationService {
    private sent: string[] = [];
    
    async sendNotification(message: string): Promise<void> {
        await delay(100); // Simulated network delay
        this.sent.push(message);
    }
    
    getSentCount(): number {
        return this.sent.length;
    }
}
```

### Test Code (Flaky)
```typescript
// notificationService.test.ts

it('should track sent notifications', async () => {
    const service = new NotificationService();
    
    // Fire and forget - doesn't await!
    service.sendNotification('Hello');
    service.sendNotification('World');
    
    // Race condition: notifications may not be sent yet
    expect(service.getSentCount()).toBe(2);
});
```

### Hambugsy Analysis
```bash
$ hambugsy analyze ./src/notificationService.ts

🍔 HAMBUGSY v1.0.0

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: sendNotification() @ line 6                         │
├─────────────────────────────────────────────────────────────────┤
│  ⚠️ INTERMITTENT: should track sent notifications               │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Test pass rate: 73% (based on CI history)                  │
│  ├── Failure pattern: Random, no correlation to changes         │
│  │                                                              │
│  ├── Detected issue: ASYNC RACE CONDITION                       │
│  │   • sendNotification() is async (returns Promise)            │
│  │   • Test calls method but doesn't await                      │
│  │   • Assertion runs before async operation completes          │
│  │                                                              │
│  └── Test expects: getSentCount() === 2                         │
│      Code state: May be 0, 1, or 2 depending on timing          │
│                                                                 │
│  🎯 VERDICT: FLAKY TEST (confidence: 94%)                       │
│                                                                 │
│  📝 EXPLANATION:                                                │
│  The test has a race condition. sendNotification() is           │
│  asynchronous but the test doesn't await the promises.          │
│  The assertion may run before the notifications are sent.       │
│                                                                 │
│  💡 RECOMMENDATION:                                              │
│  Fix the test to properly await async operations:               │
│                                                                 │
│  it('should track sent notifications', async () => {            │
│      const service = new NotificationService();                 │
│  -   service.sendNotification('Hello');                         │
│  -   service.sendNotification('World');                         │
│  +   await service.sendNotification('Hello');                   │
│  +   await service.sendNotification('World');                   │
│      expect(service.getSentCount()).toBe(2);                    │
│  });                                                            │
│                                                                 │
│  Or use Promise.all for parallel:                               │
│  +   await Promise.all([                                        │
│  +       service.sendNotification('Hello'),                     │
│  +       service.sendNotification('World')                      │
│  +   ]);                                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example 4: Environment Issue

### Scenario
A test fails because it depends on an external service that's down.

### Test Code
```java
// PaymentServiceIT.java (Integration Test)

@Test
void testPaymentProcessing() {
    PaymentService service = new PaymentService();
    PaymentResult result = service.processPayment(
        new PaymentRequest("card_123", 99.99)
    );
    assertEquals(PaymentStatus.SUCCESS, result.getStatus());
}
```

### Hambugsy Analysis
```bash
$ hambugsy analyze ./src/PaymentServiceIT.java

🍔 HAMBUGSY v1.0.0

┌─────────────────────────────────────────────────────────────────┐
│  📍 Test: testPaymentProcessing @ line 5                        │
├─────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: testPaymentProcessing                         │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Exception: java.net.ConnectException                       │
│  │   "Connection refused: payment-gateway.example.com:443"      │
│  │                                                              │
│  ├── No code changes detected                                   │
│  ├── No test changes detected                                   │
│  ├── External dependency: payment-gateway.example.com           │
│  │                                                              │
│  └── Network check: payment-gateway.example.com is UNREACHABLE  │
│                                                                 │
│  🎯 VERDICT: ENVIRONMENT ISSUE (confidence: 99%)                │
│                                                                 │
│  📝 EXPLANATION:                                                │
│  This is an integration test that depends on an external        │
│  payment gateway service. The service appears to be             │
│  unreachable, which is causing the test to fail.                │
│  This is not a code or test bug.                                │
│                                                                 │
│  💡 RECOMMENDATIONS:                                             │
│                                                                 │
│  Option 1: Skip test when service unavailable                   │
│  @Test                                                          │
│  @EnabledIf("isPaymentGatewayAvailable")                        │
│  void testPaymentProcessing() { ... }                           │
│                                                                 │
│  Option 2: Use WireMock for integration tests                   │
│  @WireMockTest                                                  │
│  void testPaymentProcessing(WireMockRuntimeInfo wmRuntimeInfo)  │
│                                                                 │
│  Option 3: Retry later                                          │
│  External service may be temporarily down.                      │
│  Last successful run: 2 hours ago                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example 5: Python/pytest

### Scenario
A Python function's behavior changed but tests weren't updated.

### Source Code
```python
# calculator.py

def calculate_tax(amount: float, state: str) -> float:
    """Calculate sales tax based on state."""
    rates = {
        'CA': 0.0725,  # Changed from 0.065
        'NY': 0.08,
        'TX': 0.0625,
    }
    return amount * rates.get(state, 0.0)
```

### Test Code
```python
# test_calculator.py

def test_california_tax():
    result = calculate_tax(100.0, 'CA')
    assert result == 6.50  # Expects old rate
```

### Hambugsy Analysis
```bash
$ hambugsy analyze ./src/calculator.py

🍔 HAMBUGSY v1.0.0

┌─────────────────────────────────────────────────────────────────┐
│  📍 Function: calculate_tax() @ line 3                          │
├─────────────────────────────────────────────────────────────────┤
│  ❌ FAILING TEST: test_california_tax                           │
│                                                                 │
│  🔬 ANALYSIS:                                                   │
│  ├── Test written: 2024-01-15                                   │
│  ├── Code changed: 2024-12-01                                   │
│  ├── Commit: "Update CA sales tax rate to 7.25%"                │
│  │                                                              │
│  ├── Test expects: 100.0 * 0.065 = 6.50                         │
│  └── Code returns: 100.0 * 0.0725 = 7.25                        │
│                                                                 │
│  🎯 VERDICT: OUTDATED TEST (confidence: 97%)                    │
│                                                                 │
│  📝 EXPLANATION:                                                │
│  The California sales tax rate was updated from 6.5% to         │
│  7.25% in the code. The commit message explicitly states        │
│  this was an intentional rate update. The test needs to         │
│  reflect the new rate.                                          │
│                                                                 │
│  💡 RECOMMENDATION:                                              │
│  Update test_calculator.py line 4:                              │
│  - assert result == 6.50                                        │
│  + assert result == 7.25  # CA rate updated to 7.25%            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example 6: Multiple Issues in One File

```bash
$ hambugsy analyze ./src/OrderService.java --verbose

🍔 HAMBUGSY v1.0.0 - Finding the bug in your stack...

Analyzing: ./src/OrderService.java
Correlating with: ./test/OrderServiceTest.java
Found: 5 methods, 8 tests

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: calculateDiscount() @ line 15                       │
│  🎯 VERDICT: OUTDATED TEST                                      │
│  💡 Fix test assertion: 90.0 → 85.0                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: validateOrder() @ line 42                           │
│  🎯 VERDICT: CODE BUG                                           │
│  💡 Add null check before line 45                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: processPayment() @ line 78                          │
│  🎯 VERDICT: FLAKY TEST                                         │
│  💡 Add proper async handling in test                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: sendConfirmation() @ line 95                        │
│  🎯 VERDICT: ENVIRONMENT ISSUE                                  │
│  💡 Mock email service or skip when unavailable                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: calculateTotal() @ line 110                         │
│  ✅ PASSED - All tests passing                                  │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Analyzed:          5 methods, 8 tests
  
  🐛 Code bugs:      1 (validateOrder)
  📜 Outdated tests: 1 (calculateDiscount)
  🎲 Flaky tests:    1 (processPayment)
  🌐 Environment:    1 (sendConfirmation)
  ✅ Passed:         1 (calculateTotal)

  Priority order:
  1. 🐛 validateOrder - Code bug (fix immediately)
  2. 📜 calculateDiscount - Outdated test (update test)
  3. 🎲 processPayment - Flaky test (stabilize)
  4. 🌐 sendConfirmation - Environment (mock or skip)

  Estimated time saved: ~2 hours
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Example 7: Missing Test Suggestions (suggest command)

### Scenario
Finding untested code paths and generating test suggestions.

### Source Code (Partially Tested)
```java
// PaymentService.java

public class PaymentService {
    
    public PaymentResult processPayment(PaymentRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request cannot be null");
        }
        
        if (request.getAmount() <= 0) {
            throw new ValidationException("Amount must be positive");
        }
        
        if (request.getAmount() > 10000) {
            return new PaymentResult(Status.REQUIRES_APPROVAL, "Large amount");
        }
        
        // Process payment...
        return gateway.charge(request);
    }
}
```

### Existing Test (Incomplete)
```java
// PaymentServiceTest.java

@Test
void testPayment_Success() {
    PaymentResult result = service.processPayment(
        new PaymentRequest("card_123", 99.99)
    );
    assertEquals(Status.SUCCESS, result.getStatus());
}
```

### Hambugsy Suggest Output
```bash
$ hambugsy suggest ./src/PaymentService.java

🍔 HAMBUGSY - Finding gaps in your test coverage...

┌─────────────────────────────────────────────────────────────────┐
│  📍 Method: processPayment() @ line 5                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ TESTED: Happy path (success case)                           │
│                                                                 │
│  ❌ MISSING TESTS:                                              │
│  ├── 🔴 CRITICAL: null request input (line 6)                   │
│  ├── 🔴 CRITICAL: zero/negative amount (line 10)                │
│  ├── 🟡 HIGH: large amount approval threshold (line 14)         │
│  └── 🟡 HIGH: gateway failure handling                          │
│                                                                 │
│  💡 SUGGESTED TESTS:                                            │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @Test                                                      │ │
│  │ void processPayment_ShouldThrow_WhenRequestIsNull() {      │ │
│  │     assertThrows(IllegalArgumentException.class,           │ │
│  │         () -> service.processPayment(null));               │ │
│  │ }                                                          │ │
│  │                                                            │ │
│  │ @Test                                                      │ │
│  │ void processPayment_ShouldThrow_WhenAmountIsNegative() {   │ │
│  │     var request = new PaymentRequest("card", -50.0);       │ │
│  │     assertThrows(ValidationException.class,                │ │
│  │         () -> service.processPayment(request));            │ │
│  │ }                                                          │ │
│  │                                                            │ │
│  │ @Test                                                      │ │
│  │ void processPayment_ShouldRequireApproval_WhenOver10k() {  │ │
│  │     var request = new PaymentRequest("card", 15000.0);     │ │
│  │     var result = service.processPayment(request);          │ │
│  │     assertEquals(Status.REQUIRES_APPROVAL, result);        │ │
│  │ }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TEST COVERAGE GAP SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Methods analyzed:     1
  Existing tests:       1
  Missing tests:        4
  
  By priority:
  🔴 Critical:          2 (null checks, validation)
  🟡 High:              2 (edge cases, error handling)
  🟢 Medium:            0
  
  Estimated effort:     ~30 minutes to add all tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Generate Tests Automatically

```bash
$ hambugsy suggest ./src/PaymentService.java --generate --output=./generated-tests/

🍔 Generated 4 test files:
  ✅ PaymentServiceNullTest.java
  ✅ PaymentServiceValidationTest.java
  ✅ PaymentServiceEdgeCaseTest.java
  ✅ PaymentServiceErrorTest.java

Output directory: ./generated-tests/
```

---

## JSON Output Example

```bash
$ hambugsy analyze ./src --format=json
```

```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "config": {
    "confidence_threshold": 0.7,
    "git_history_days": 90
  },
  "analyzed": {
    "files": 12,
    "methods": 45,
    "tests": 89
  },
  "results": [
    {
      "id": "order-service-calculate-discount",
      "method": {
        "name": "calculateDiscount",
        "file": "src/OrderService.java",
        "line": 15,
        "signature": "double calculateDiscount(double price, boolean isPremium)"
      },
      "test": {
        "name": "testPremiumDiscount",
        "file": "test/OrderServiceTest.java",
        "line": 25,
        "framework": "junit5"
      },
      "verdict": {
        "type": "OUTDATED_TEST",
        "confidence": 0.96,
        "reason": "Code intentionally changed after test was written"
      },
      "analysis": {
        "testExpectation": {
          "description": "Premium discount should be 10%",
          "assertion": "assertEquals(10.0, result)",
          "extractedValue": 10.0
        },
        "codeBehavior": {
          "description": "Returns 15% discount for premium users",
          "implementation": "return price * 0.15",
          "computedValue": 15.0
        },
        "divergence": {
          "type": "VALUE_MISMATCH",
          "expected": 10.0,
          "actual": 15.0,
          "semanticDifference": "Discount rate changed from 10% to 15%"
        },
        "history": {
          "testLastModified": "2024-03-15T09:00:00Z",
          "codeLastModified": "2024-11-22T14:30:00Z",
          "relevantCommit": {
            "hash": "a1b2c3d4",
            "message": "feat: update premium discount to 15% per new pricing policy",
            "author": "bob@example.com",
            "date": "2024-11-22T14:30:00Z"
          }
        }
      },
      "recommendation": {
        "action": "UPDATE_TEST",
        "file": "test/OrderServiceTest.java",
        "line": 28,
        "change": {
          "before": "assertEquals(10.0, result);",
          "after": "assertEquals(15.0, result);"
        },
        "explanation": "Update the assertion to match the new 15% premium discount rate"
      }
    }
  ],
  "summary": {
    "codeBugs": 1,
    "outdatedTests": 3,
    "flakyTests": 1,
    "environmentIssues": 0,
    "passed": 84,
    "estimatedTimeSaved": "3h 15m"
  }
}
```

---

## CI/CD Output Examples

### GitHub Actions Annotations

```bash
$ hambugsy analyze ./src --format=github
```

Output:
```
::error file=src/OrderService.java,line=42,col=5,title=Code Bug::Missing null check in validateOrder(). Test expects ValidationException but code returns null. Confidence: 91%
::warning file=test/OrderServiceTest.java,line=28,col=9,title=Outdated Test::Update assertion from 10.0 to 15.0 to match new discount policy. Confidence: 96%
::notice file=test/NotificationServiceTest.java,line=15,col=9,title=Flaky Test::Race condition detected. Add await to async calls. Confidence: 94%
```

### GitLab CI Report

```bash
$ hambugsy analyze ./src --format=gitlab > gl-code-quality-report.json
```

```json
[
  {
    "description": "Code Bug: Missing null check in validateOrder()",
    "check_name": "hambugsy",
    "fingerprint": "order-service-validate-order",
    "severity": "major",
    "location": {
      "path": "src/OrderService.java",
      "lines": {
        "begin": 42
      }
    }
  }
]
```
