---
description: Invoke Claude Code CLI — model/effort matched to task, logged
permission:
  bash: ask
---
Use `claude --print` (non-interactive; required because the Bash tool cannot feed input to an interactive TUI).

### Model & effort selection

Choose the most cost-effective combination for the task — not automatically the cheapest:

| Task scope | Model | Effort | Bash timeout (ms) |
|---|---|---|---|
| Trivial (typo, format, 1-file review) | sonnet | low | 120_000 |
| Simple (small logic change, 2-3 file review) | sonnet | medium | 180_000 |
| Moderate (multi-file feature, state mgmt) | sonnet | high | 300_000 |
| Complex (architecture, data flow, security) | opus | high | 420_000 |
| Critical (auth, payments, PII, core infra) | opus | xhigh–max | 600_000 |

**Timeout rule:** Opus Max with a full workspace diff reads files sequentially (Read tool is single-threaded) — when reviewing 5+ changed files across the codebase, it can take 5-10 minutes. Do NOT set a bash timeout shorter than the table value or the session will abort while Claude is mid-review, wasting tokens.

### Logging

After every Claude invocation, append a one-line entry to `tools/claude-ft-kilo/claude-kilo.md`:

```bash
echo "| $(date -u +%Y-%m-%dT%H:%M:%SZ) | $MODEL | $EFFORT | $PROMPT_SUMMARY | $OUTCOME_SUMMARY |" >> tools/claude-ft-kilo/claude-kilo-log.md
```

On first use, create the log file with a header:

```bash
echo "| Timestamp | Model | Effort | Prompt | Outcome |" >> tools/claude-ft-kilo/claude-kilo.md
echo "|---|---|---|---|---|" >> tools/claude-ft-kilo/claude-kilo-log.md
```

### Full invocation pattern

```bash
claude --model <model> --effort <effort> \
  [--allowedTools "list of tools"] \
  -p "<concise prompt>"
```

Keep prompts tight — constrain the response format (e.g. "Reply: APPROVED or list specific issues.") to minimize token burn. Restrict tools with `--allowedTools` when Claude doesn't need full workspace access.
