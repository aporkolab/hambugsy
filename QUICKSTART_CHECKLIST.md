# 🚀 Hambugsy Quick Start Checklist

## TE CSINÁLOD (most, mielőtt Claude Code)

### 1. Domain vásárlás
- [ ] hambugsy.dev (~$11)
- [ ] hambugsy.com (~$11)
- Namecheap: https://www.namecheap.com/domains/registration/results/?domain=hambugsy

### 2. GitHub Repo
- [ ] https://github.com/new
- [ ] Név: `hambugsy`
- [ ] Public: ✅
- [ ] NO README (mi adjuk)
- [ ] License: MIT
- [ ] .gitignore: Node

### 3. Lokális mappa
```bash
mkdir ~/projects/hambugsy
cd ~/projects/hambugsy
git init
git remote add origin https://github.com/APorkolab/hambugsy.git
```

### 4. Dokumentáció másolása
```bash
# Másold be a letöltött fájlokat:
# A gyökérbe:
cp ~/Downloads/README.md .
cp ~/Downloads/LICENSE .
cp ~/Downloads/package.json .
cp ~/Downloads/.hambugsy.yml .

# docs/ mappába:
mkdir docs
cp ~/Downloads/TECHNICAL_SPEC.md docs/
cp ~/Downloads/ARCHITECTURE.md docs/
cp ~/Downloads/EXAMPLES.md docs/
cp ~/Downloads/IMPLEMENTATION_GUIDE.md docs/
cp ~/Downloads/CONTRIBUTING.md docs/
cp ~/Downloads/CLI_REFERENCE.md docs/
cp ~/Downloads/CONFIG_REFERENCE.md docs/
cp ~/Downloads/TROUBLESHOOTING.md docs/
cp ~/Downloads/ROADMAP.md docs/
cp ~/Downloads/COMPETITIVE_ANALYSIS.md docs/
cp ~/Downloads/MARKETING_ONEPAGER.md docs/

# Tartsd külön (DEV.to submission):
cp ~/Downloads/DEV_SUBMISSION.md ~/Desktop/
```

### 5. Copilot CLI check
```bash
gh copilot --version
# Ha error: gh extension install github/gh-copilot
```

### 6. Első commit
```bash
git add .
git commit -m "docs: initial project documentation"
git push -u origin main
```

---

## CLAUDE CODE CSINÁL (session-önként)

### Session 1: Project Init
```
Prompt: Inicializáld a Hambugsy CLI projektet TypeScript-ben...
Eredmény: npm run dev -- --help működik
```

### Session 2: Core Types
```
Prompt: Hozd létre a src/core/types.ts fájlt...
Eredmény: Minden type exportálva
```

### Session 3: Copilot Bridge
```
Prompt: Hozd létre a src/services/copilot.ts fájlt...
Eredmény: gh copilot explain hívás működik
```

### Session 4: Java Parser
```
Prompt: Hozd létre a src/parser/java/parser.ts fájlt...
Eredmény: Java fájl parse-olása működik
```

### Session 5: Git Service
```
Prompt: Hozd létre a src/services/git.ts fájlt...
Eredmény: git log/blame hívások működnek
```

### Session 6: Verdict Engine
```
Prompt: Hozd létre a src/verdict/engine.ts fájlt...
Eredmény: Verdict generálás működik
```

### Session 7: Analyze Command
```
Prompt: Hozd létre a src/cli/commands/analyze.ts fájlt...
Eredmény: hambugsy analyze ./file.java működik
```

### Session 8: Suggest Command
```
Prompt: Hozd létre a src/cli/commands/suggest.ts fájlt...
Eredmény: hambugsy suggest ./file.java működik
```

### Session 9: Console Reporter
```
Prompt: Hozd létre a src/cli/output/console.ts fájlt...
Eredmény: Szép boxos output
```

### Session 10: Fixtures & Tests
```
Prompt: Hozd létre a test fixture-öket...
Eredmény: Demo működik
```

---

## VÉGSŐ CHECKLIST (submission előtt)

### Code
- [ ] `hambugsy analyze` működik Java fájlon
- [ ] `hambugsy suggest` működik
- [ ] Szép console output
- [ ] JSON output (`--format=json`)
- [ ] GitHub Actions format (`--format=github`)

### Repo
- [ ] README.md naprakész
- [ ] LICENSE megvan
- [ ] Szép badge-ek a README-ben
- [ ] Screenshots/GIF a README-ben

### Demo
- [ ] 30 másodperces GIF
- [ ] Demo video (opcionális)
- [ ] Working fixture files

### DEV.to Submission
- [ ] DEV_SUBMISSION.md átmásolva DEV.to-ra
- [ ] Cover image feltöltve
- [ ] Tags: #githubcopilotcli #testing #devtools #opensource
- [ ] YouTube/GIF beágyazva
- [ ] Repo link működik

### Deadline
- [ ] **Február 15, 2026 23:59 PT**
- [ ] Budapesti idő: **Február 16, 08:59**

---

## Emergency Contacts

- GitHub Copilot CLI docs: https://docs.github.com/en/copilot/github-copilot-in-the-cli
- DEV.to Challenge: https://dev.to/challenges/github
- Submission template: https://dev.to/challenges/github#submission-template
