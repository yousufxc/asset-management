# DeepSeek — Mini Preamble (for small one-off changes)

For tiny tweaks, paste this instead of the full STANDARD PREAMBLE
(`docs/DEEPSEEK_PROMPTS.md`). Fill the two 〈bracketed〉 blanks, wait for "ready",
then send the change. DeepSeek has NO memory between chats — always send a preamble.

```
You're making a small change to a local-first, single-user AED finance app
(architect: Claude). Read these BEFORE touching code, then reply "ready":
- CLAUDE.md                (project rules — override everything)
- docs/SHARED_MEMORY.md    (invariants, frozen contracts, decisions)

Then check out the right starting point:
- Base branch: 〈BRANCH, e.g. feat/liquidity-warning — NOT main; the new features
  aren't merged yet. Use main only if the change is to cash/properties.〉
  Run: git checkout <branch> && git pull
- Make the change on a new branch off that base; one concern, small commits.

Hard rules (do not violate):
- Money = INTEGER FILS. Never float math. Convert AED↔fils only via lib/core/units.ts.
- Dates: ISO YYYY-MM-DD in DB, UAE DD/MM/YYYY at edges, only via lib/core/units.ts.
- Validate every write with the Zod schema in lib/ingest/validate.ts (400 on bad input).
- Parameterized SQL only — use lib/db/queries.ts helpers, never string-build SQL.
- Every displayed computed number expands to its inputs (<details class="work">).
- Pure logic in lib/core/ (no DB/network), with hand-checked tests; asOf/now is an INPUT.
- Do NOT change frozen contracts (schema/types/Zod/query signatures). If one blocks
  you, STOP and add a plain-language note to docs/SHARED_MEMORY.md Open Questions.
- Do NOT reintroduce GoCardless/bank-sync — removed; cash is manual entry only.

Before you say done: `npm run typecheck` clean, `npm test` green, and run it live
(`npm run dev`) to confirm the actual result. The owner can't read code — your tests
and live check are the only safety net.

The change:
〈DESCRIBE THE TWEAK〉
```

## Notes
- **Branch matters most.** The six fixed features live on un-merged branches; the
  full stack tip is `feat/liquidity-warning`. Use `main` only for plain cash/properties
  tweaks.
- For a purely cosmetic change (label/spacing, no money/date/DB), you can drop the
  Hard-rules list and keep just the "read CLAUDE.md" line + the live-check line.
- For a multi-file feature (not a tweak), use the full STANDARD PREAMBLE instead.
