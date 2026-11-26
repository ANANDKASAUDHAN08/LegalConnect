/**
 * Escapes special regex characters in a string so it can be safely
 * used inside `new RegExp()` without causing ReDoS or syntax errors.
 *
 * Characters with `(`, `)`, `+`, `&`, etc. in practice area names
 * (e.g. "Bail Matters & Remand") would otherwise break or match wrong records.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}