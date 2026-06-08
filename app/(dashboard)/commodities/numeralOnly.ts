import type { KeyboardEvent } from "react";

export function numeralOnly(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" || e.key === "Enter") return;
  if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") return;
  if (/^[0-9.]$/.test(e.key)) return;
  e.preventDefault();
}
