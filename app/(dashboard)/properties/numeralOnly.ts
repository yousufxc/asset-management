import type { KeyboardEvent } from "react";

/**
 * Block non-numeric keystrokes on `type="number"` money/size inputs.
 * Allows: digits, ".", navigation keys, and Ctrl/⌘/Alt combos (so paste still
 * works). Blocks letters and `e`/`E`/`+`/`-` (no scientific notation, no
 * negatives — these fields are all nonnegative). Shared by the add and edit
 * property forms so the behaviour can't drift between them.
 */
export function numeralOnly(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" || e.key === "Enter") return;
  if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") return;
  if (/^[0-9.]$/.test(e.key)) return;
  e.preventDefault();
}
