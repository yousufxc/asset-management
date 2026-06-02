# Liquidity & Asset Orchestration Platform

A private, local-first tool for managing a multi-asset personal portfolio (UAE property, precious metals, cash) with a liquidity-first focus. Single user, single machine, single currency (AED).

The core question this answers: *do I have enough liquid cash to cover what I owe on any future date — and if not, how short am I and how long do I have?*

---

## One-time setup (Mac)

You only do this section once. Copy each block into Terminal (press ⌘+Space, type "Terminal", hit Enter).

### 1. Install Homebrew (Mac package manager)
Check if you already have it:
```bash
brew --version
```
If that errors, install it:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
After it finishes, it prints two lines starting with `echo` and `eval` to "add Homebrew to your PATH". Copy and run those two lines exactly as shown.

### 2. Install Node.js (runs the app) and Git (version control)
```bash
brew install node git
```
Verify:
```bash
node --version   # should print v20 or higher
git --version
```

### 3. Tell Git who you are
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 4. Install the GitHub CLI and log in
```bash
brew install gh
gh auth login
```
When prompted, choose: **GitHub.com** → **HTTPS** → **Yes** (authenticate Git) → **Login with a web browser**. It shows a one-time code; copy it, press Enter, paste the code into the browser page that opens, and authorize.

Verify you're logged in:
```bash
gh auth status
```

### 5. Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```
Verify:
```bash
claude --version
```

---

## Create the project repo

### 1. Make a folder and go into it
```bash
mkdir -p ~/projects/asset-platform && cd ~/projects/asset-platform
```

### 2. Initialize git and create the GitHub repo (private)
```bash
git init
gh repo create asset-platform --private --source=. --remote=origin
```

### 3. Add the handoff files
Move the `CLAUDE.md` and this `README.md` into this folder, then:
```bash
git add CLAUDE.md README.md .gitignore .env.example
git commit -m "chore: project handoff files and CLAUDE.md"
git push -u origin main
```

---

## API keys you'll need

Create a file named `.env.local` in the project folder (Claude Code will help, or do it manually). It must **never** be committed — the `.gitignore` already excludes it. Use `.env.example` as the template.

| Key | What it's for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Parsing SPA/statement PDFs | console.anthropic.com → API Keys |
| `METALS_DEV_API_KEY` | Precious-metal spot prices | metals.dev → sign up |

You do not need all of them on day one — Phase 1 only needs `ANTHROPIC_API_KEY`.

---

## Handing off to Claude Code

From inside the project folder:
```bash
claude
```
Then give it your first instruction, for example:

> Read CLAUDE.md fully. Then begin Phase 1: scaffold the Next.js app, set up the SQLite schema with WAL mode, and build the manual data-entry UI for the four asset classes. Follow every non-negotiable rule. Ask me product questions in plain language if any financial logic is ambiguous.

Claude Code will work in branches and open small PRs. Your job is to run the app, look at it, and give visual feedback — and to answer the plain-language product questions it asks.

---

## Running the app (once it exists)
```bash
cd ~/projects/asset-platform
npm install      # first time, and whenever dependencies change
npm run dev      # then open the URL it prints (usually http://localhost:3000)
```
To stop it: press `Ctrl+C` in the Terminal window running it.

---

## A note on trust

You are doing visual QA, not code review. The CLAUDE.md instructs Claude Code to build a safety net for the bugs you *can't* see: automated data-integrity tests, and a "show your work" rule so every number on screen can be expanded to reveal the raw inputs behind it. If a number ever looks wrong, expand it — that's your window into whether the math or the data is at fault.
