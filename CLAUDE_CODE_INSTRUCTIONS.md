# 🤖 Claude Code Instructions for Hambugsy

## Prerequisites (Te csinálod, nem Claude Code)

### 1. GitHub Repo létrehozása

```bash
# Menj a GitHub-ra és hozz létre egy új repo-t:
# https://github.com/new
# 
# Név: hambugsy
# Leírás: 🍔 The CLI tool that tells you WHO is wrong: your test or your code
# Public: ✅
# Add README: ❌ (majd mi adjuk hozzá)
# License: MIT
# .gitignore: Node
```

### 2. Lokális setup

```bash
# Klónozd le a repo-t
git clone https://github.com/APorkolab/hambugsy.git
cd hambugsy

# Vagy ha már van a mappa:
mkdir hambugsy
cd hambugsy
git init
git remote add origin https://github.com/APorkolab/hambugsy.git
```

### 3. Dokumentáció másolása

```bash
# Másold be az összes dokumentációs fájlt amit generáltunk:
# - README.md
# - TECHNICAL_SPEC.md
# - ARCHITECTURE.md
# - EXAMPLES.md
# - IMPLEMENTATION_GUIDE.md
# - DEV_SUBMISSION.md
# - CONTRIBUTING.md
# - COMPETITIVE_ANALYSIS.md
# - CLI_REFERENCE.md
# - CONFIG_REFERENCE.md
# - TROUBLESHOOTING.md
# - ROADMAP.md
# - MARKETING_ONEPAGER.md
# - package.json
# - .hambugsy.yml
# - LICENSE

# Tedd őket a docs/ mappába (README és LICENSE marad gyökérben)
mkdir docs
mv TECHNICAL_SPEC.md ARCHITECTURE.md EXAMPLES.md ... docs/
```

### 4. GitHub Copilot CLI ellenőrzés

```bash
# Ellenőrizd, hogy működik-e
gh copilot --version

# Ha nincs:
gh extension install github/gh-copilot
gh auth login
```

---

## Claude Code Session #1: Project Initialization

### Prompt:

```
Inicializáld a Hambugsy CLI projektet TypeScript-ben.

A projekt egy CLI tool ami teszt hibákat diagnosztizál és megmondja, hogy a teszt vagy a kód hibás.

Követelmények:
1. TypeScript strict mode
2. ESM modules (type: "module")
3. Commander.js a CLI-hez
4. A struktúra:

hambugsy/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── analyze.ts
│   │   │   ├── suggest.ts
│   │   │   └── init.ts
│   │   └── output/
│   │       ├── console.ts
│   │       └── json.ts
│   ├── core/
│   │   ├── types.ts
│   │   └── orchestrator.ts
│   ├── parser/
│   │   └── java/
│   │       └── parser.ts
│   ├── services/
│   │   ├── copilot.ts
│   │   └── git.ts
│   └── verdict/
│       └── engine.ts
├── test/
│   └── fixtures/
│       └── java/
├── package.json
├── tsconfig.json
└── .gitignore

Használd ezeket a függőségeket:
- commander (CLI)
- chalk (colors)
- ora (spinner)
- execa (process execution)
- glob (file patterns)
- yaml (config parsing)

Dev dependencies:
- typescript
- @types/node
- tsx (dev running)
- tsup (bundling)
- vitest (testing)

Hozd létre az alap fájlokat működő "hello world" szintű kóddal, hogy a `npm run dev -- --help` működjön.
```

---

## Claude Code Session #2: Core Types

### Prompt:

```
Hozd létre a src/core/types.ts fájlt a Hambugsy projekt összes TypeScript típusával.

Szükséges típusok:

1. TestCase - egy teszt metódus reprezentációja
   - name, filePath, lineNumber, endLine
   - framework (junit5, jest, pytest, etc.)
   - assertions: Assertion[]
   - body: string

2. Assertion - egy assertion a tesztben
   - type: 'equals' | 'throws' | 'truthy' | 'contains' | 'other'
   - expected, actual, lineNumber, raw

3. SourceMethod - egy forráskód metódus
   - name, filePath, lineNumber, endLine
   - parameters: Parameter[]
   - returnType, body, className?

4. TestSourcePair - összekapcsolt teszt és forrás
   - test: TestCase
   - source: SourceMethod
   - confidence: number
   - correlationType: 'NAMING_CONVENTION' | 'IMPORT_ANALYSIS' | etc.

5. AnalysisResult - elemzés eredménye
   - pair: TestSourcePair
   - testExpectation: Expectation
   - codeBehavior: Behavior
   - divergence: Divergence | null
   - gitContext: GitContext

6. Verdict - a végső ítélet
   - type: 'CODE_BUG' | 'OUTDATED_TEST' | 'FLAKY_TEST' | 'ENVIRONMENT_ISSUE' | 'PASSED'
   - confidence: number
   - reason, explanation
   - recommendation: Recommendation

7. MissingTest - hiányzó teszt javaslat (a suggest command-hoz)
   - methodName, filePath, lineNumber
   - pattern: 'NULL_CHECK' | 'EMPTY_COLLECTION' | 'BOUNDARY' | 'EXCEPTION' | etc.
   - priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'
   - suggestedTest: string (generált teszt kód)

Exportálj mindent named export-tal.
```

---

## Claude Code Session #3: Copilot Bridge

### Prompt:

```
Hozd létre a src/services/copilot.ts fájlt ami a GitHub Copilot CLI-vel kommunikál.

Ez a Hambugsy LEGFONTOSABB része - itt használjuk a Copilot CLI-t az AI elemzéshez.

Követelmények:

1. CopilotBridge class a következő metódusokkal:
   
   - explain(code: string, question: string): Promise<string>
     Használja: gh copilot explain "..."
   
   - analyzeTestExpectation(testCode: string): Promise<{description: string}>
     Kérdezd meg a Copilot-ot: "Mit vár el ez a teszt?"
   
   - analyzeCodeBehavior(code: string): Promise<{description: string}>
     Kérdezd meg: "Mit csinál ez a kód?"
   
   - explainDivergence(test: string, source: string): Promise<string>
     Kérdezd meg: "Miért nem egyezik a teszt és a kód?"
   
   - suggestFix(context: {...}): Promise<{file, suggestion, explanation}>
     Használja: gh copilot suggest -t code "..."
   
   - suggestMissingTests(code: string): Promise<MissingTest[]>
     Kérdezd meg: "Milyen tesztek hiányoznak ehhez a kódhoz?"

2. Rate limiting:
   - Használj p-queue-t
   - Max 2 concurrent request
   - Max 5 request per second

3. Error handling:
   - Timeout: 30 sec
   - Retry: 3x
   - Meaningful error messages

4. Az execa package-et használd a process futtatáshoz.

FONTOS: A gh copilot explain és gh copilot suggest parancsokat PONTOSAN így kell hívni,
mert ez a hivatalos GitHub Copilot CLI szintaxis.
```

---

## Claude Code Session #4: Java Parser

### Prompt:

```
Hozd létre a src/parser/java/parser.ts fájlt ami Java/JUnit fájlokat parse-ol.

NEM kell tree-sitter, használj EGYSZERŰ regex-alapú parsing-ot az MVP-hez.

Követelmények:

1. JavaParser class:
   
   - parseFile(filePath: string): Promise<{tests: TestCase[], methods: SourceMethod[]}>
   
2. Test detection:
   - Keress @Test annotációt
   - Extraháld a metódus nevét, line number-t
   - Extraháld az assertion-öket (assertEquals, assertTrue, assertThrows, etc.)
   
3. Method detection:
   - Keress public/protected/private metódusokat
   - Extraháld: név, paraméterek, return type, body
   - SKIP: @Test annotált metódusokat (azok tesztek)
   
4. Assertion extraction:
   - assertEquals(expected, actual) -> type: 'equals', expected, actual
   - assertTrue(condition) -> type: 'truthy'
   - assertThrows(Exception.class, () -> ...) -> type: 'throws'

Regex példák amiket használhatsz:
- /@Test\s*\n\s*(public\s+)?void\s+(\w+)/g - teszt metódus
- /assertEquals\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g - assertEquals

Az MVP-hez a regex elég jó, később lehet tree-sitter-re váltani.
```

---

## Claude Code Session #5: Git Service

### Prompt:

```
Hozd létre a src/services/git.ts fájlt a Git history elemzéshez.

Követelmények:

1. GitService class:
   
   - getHistory(filePath: string, limit?: number): Promise<Commit[]>
     Használja: git log --format="%H|%an|%ai|%s" -- {file}
   
   - blame(filePath: string, startLine: number, endLine: number): Promise<BlameInfo[]>
     Használja: git blame -L {start},{end} --line-porcelain {file}
   
   - getLastModification(filePath: string, lineNumber: number): Promise<Commit>
     Kombinálja a blame-et és history-t
   
   - isIntentionalChange(commitMessage: string): boolean
     True ha: feat:, refactor:, "update policy", JIRA-123, etc.
     False ha: fix:, bug, typo, oops, revert

2. Types:
   - Commit: { hash, author, date: Date, message }
   - BlameInfo: { lineNumber, commit: Commit }

3. Az execa-t használd a git parancsok futtatásához.

4. Error handling:
   - Ha nem git repo: throw meaningful error
   - Ha nincs history: return empty array
```

---

## Claude Code Session #6: Verdict Engine

### Prompt:

```
Hozd létre a src/verdict/engine.ts fájlt ami a végső ítéletet hozza.

Ez használja a CopilotBridge-et és GitService-t az analízishez.

Követelmények:

1. VerdictEngine class:
   
   constructor(copilot: CopilotBridge, git: GitService)
   
   - determine(analysis: AnalysisResult): Promise<Verdict>
     
     Logika:
     1. Ha nincs divergence -> PASSED
     2. Ha code újabb mint test ÉS commit message intentional -> OUTDATED_TEST
     3. Ha code újabb mint test ÉS commit message accidental -> CODE_BUG (regression)
     4. Ha test újabb vagy egyidős -> CODE_BUG
     
   - calculateConfidence(analysis, verdictType): number
     Base: 0.7
     + 0.1 ha clear commit message
     + 0.05 ha strong correlation
     + 0.1 ha VALUE_MISMATCH divergence
     Max: 0.99

2. Helper methods:
   - createOutdatedTestVerdict(analysis): Promise<Verdict>
   - createCodeBugVerdict(analysis, isRegression: boolean): Promise<Verdict>
   
3. A Verdict-nek tartalmaznia kell:
   - Recommendation: melyik fájl, melyik sor, mi a before/after
   - A CopilotBridge.suggestFix()-et használd a fix generáláshoz
```

---

## Claude Code Session #7: Analyze Command

### Prompt:

```
Hozd létre a src/cli/commands/analyze.ts fájlt ami az "analyze" parancsot implementálja.

Ez a fő entry point ami összefogja az egész flow-t.

Követelmények:

1. analyzeCommand(path: string, options: AnalyzeOptions): Promise<void>
   
   Options:
   - recursive?: boolean
   - filter?: 'bugs' | 'tests' | 'all'
   - format?: 'console' | 'json' | 'github'
   - verbose?: boolean
   - confidence?: string

2. Flow:
   1. Spinner: "Checking GitHub Copilot CLI..."
   2. checkCopilotCli() - ellenőrizd hogy telepítve van
   3. Spinner: "Discovering files..."
   4. discoverFiles(path, recursive) - glob pattern matching
   5. Spinner: "Analyzing {n} files..."
   6. Minden fájlra:
      a. Parse (JavaParser)
      b. Correlate tests to methods
      c. Analyze each pair (CopilotBridge)
      d. Determine verdict (VerdictEngine)
   7. Filter results
   8. Output (Console/JSON/GitHub)
   9. Exit code: 0 ha nincs bug, 1 ha van

3. Progress callback:
   (progress: {current, total, file}) => spinner.text = ...

4. Error handling:
   - Copilot not found: meaningful message + install command
   - Parse error: skip file, warn
   - Git error: continue without git context
```

---

## Claude Code Session #8: Suggest Command

### Prompt:

```
Hozd létre a src/cli/commands/suggest.ts fájlt ami a "suggest" parancsot implementálja.

Ez a KILLER FEATURE - hiányzó tesztek keresése és generálása.

Követelmények:

1. suggestCommand(path: string, options: SuggestOptions): Promise<void>
   
   Options:
   - recursive?: boolean
   - format?: 'console' | 'json'
   - generate?: boolean (generáljon-e teszt kódot)
   - priority?: 'critical' | 'high' | 'medium' | 'all'
   - output?: string (output directory for generated tests)

2. Flow:
   1. Parse all source files
   2. Parse all test files
   3. Match tests to methods
   4. Identify methods with NO or INCOMPLETE tests
   5. For each gap:
      a. Analyze what's missing (null check, boundary, etc.)
      b. Ask Copilot to generate test suggestion
      c. Prioritize (CRITICAL > HIGH > MEDIUM)
   6. Output suggestions
   7. If --generate: write test files

3. Missing test patterns to detect:
   - NULL_CHECK: Method has parameter but no null test
   - EMPTY_COLLECTION: Method takes List/Array but no empty test
   - BOUNDARY: Method has numeric param but no 0/-1/MAX test
   - EXCEPTION: Method can throw but no assertThrows test
   - ASYNC_ERROR: Async method but no rejection test

4. Use CopilotBridge.suggestMissingTests() for AI-powered detection

5. Output format:
   📍 methodName() @ line N
   ├── ✅ TESTED: happy path
   ├── ❌ MISSING: null input (CRITICAL)
   └── ❌ MISSING: boundary values (MEDIUM)
   
   💡 SUGGESTED TEST: [generated code]
```

---

## Claude Code Session #9: Console Reporter

### Prompt:

```
Hozd létre a src/cli/output/console.ts fájlt a szép CLI output-hoz.

Ez adja a "wow factor"-t - a vizuálisan szép kimenet.

Követelmények:

1. ConsoleReporter class:
   
   - print(results: VerdictResult[]): void
   - printSuggestResults(suggestions: MissingSuggestion[]): void

2. Design:
   - Használj chalk-ot a színekhez
   - Box-drawing karakterek: ┌ ┐ └ ┘ ├ │ ─
   - Emoji icons: 🍔 🐛 📜 🎲 🌐 ✅ ❌ 💡 📍

3. Verdict output format:
   
   ┌─────────────────────────────────────────────────────────────────┐
   │  📍 Method: calculateTotal() @ line 47                          │
   ├─────────────────────────────────────────────────────────────────┤
   │  ❌ FAILING TEST: testCalculateTotal                            │
   │                                                                 │
   │  🔬 ANALYSIS:                                                   │
   │  ├── Test expects: 10% discount                                 │
   │  └── Code applies: 15% discount                                 │
   │                                                                 │
   │  🎯 VERDICT: OUTDATED TEST (96%)                                │
   │                                                                 │
   │  💡 RECOMMENDATION:                                              │
   │  - assertEquals(90.0, result);                                  │
   │  + assertEquals(85.0, result);                                  │
   └─────────────────────────────────────────────────────────────────┘

4. Summary section:
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📊 SUMMARY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     🐛 Code bugs:      1
     📜 Outdated tests: 2
     ✅ Passed:         5
     
     Estimated time saved: ~45 minutes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. Colors:
   - Red: CODE_BUG, errors
   - Yellow: OUTDATED_TEST, warnings
   - Green: PASSED, fixes
   - Cyan: info, method names
   - Gray: boxes, separators
```

---

## Claude Code Session #10: Test Fixtures & Integration

### Prompt:

```
Hozd létre a test fixture-öket és egy alap integrációs tesztet.

1. test/fixtures/java/OrderService.java:
   
   Egy egyszerű Java class:
   - calculateDiscount(double price, boolean isPremium): double
   - validateOrder(Order order): void (throws ValidationException)
   - processPayment(PaymentRequest request): PaymentResult
   
   A calculateDiscount-ban legyen egy "bug": 15% discount 10% helyett

2. test/fixtures/java/OrderServiceTest.java:
   
   JUnit 5 tesztek:
   - testPremiumDiscount() - OUTDATED (expects 10%)
   - testValidateOrder_NullInput() - MISSING
   - testProcessPayment_Success() - PASSING

3. test/integration/analyze.test.ts:
   
   Vitest teszt:
   - it('should detect outdated test', async () => {...})
   - it('should detect code bug', async () => {...})
   - it('should suggest missing tests', async () => {...})

4. Ezek a fixture-ök lesznek a demo alapja is!
```

---

## Futtatási sorrend

```bash
# 1. Repo klónozás után
cd hambugsy

# 2. Claude Code Session #1 - init
# 3. npm install
# 4. npm run dev -- --help  # Működik?

# 5. Claude Code Session #2-9 sorban
# Minden session után teszteld:
npm run dev -- analyze ./test/fixtures/java/OrderService.java

# 6. Ha minden működik:
npm run build
npm link
hambugsy --help

# 7. Commit és push
git add .
git commit -m "feat: initial MVP implementation"
git push origin main
```

---

## Debugging Tips

```bash
# Ha a Copilot CLI nem működik:
gh auth status
gh copilot --version

# Ha parse error van:
npm run dev -- analyze ./file.java --verbose

# Ha a git service nem működik:
git log --oneline -5  # Van history?

# Teljes debug mode:
DEBUG=hambugsy:* npm run dev -- analyze ./src
```

---

## MVP Definition (Challenge Deadline-ra)

**MUST HAVE:**
- [x] `hambugsy analyze` command működik
- [x] Java/JUnit parsing
- [x] Copilot integration (explain + suggest)
- [x] Verdict: CODE_BUG vs OUTDATED_TEST
- [x] Console output (szép)
- [x] GitHub repo public

**SHOULD HAVE:**
- [ ] `hambugsy suggest` command
- [ ] JSON output
- [ ] GitHub Actions format

**NICE TO HAVE:**
- [ ] TypeScript/Jest support
- [ ] Config file support
- [ ] --fix flag

---

## Demo Script (30 seconds)

```bash
# Terminal 1: Show the "problem"
cat test/fixtures/java/OrderServiceTest.java
# "Here's a failing test..."

# Terminal 2: Run Hambugsy
hambugsy analyze ./test/fixtures/java/

# Show output:
# 🍔 HAMBUGSY
# 🎯 VERDICT: OUTDATED TEST
# 💡 Fix: Change 90.0 to 85.0

# "Hambugsy told me the test is outdated, not the code!"
# "It even shows me the exact fix!"
```
