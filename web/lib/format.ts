export const pct = (x: number | null | undefined) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
export const num1 = (x: number) => (Math.round(x * 10) / 10).toString();
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
export const STYLE_BLURB: Record<string, string> = {
  Aggressive: 'You press the attack: lots of strikes per minute and little blocking.',
  Defensive: 'You absorb pressure well: a high share of incoming attacks get blocked and you attack selectively.',
  Technical: 'You mix your moves and connect often: varied actions, good contact rate, plenty of movement.',
  Balanced: 'No single trait dominates yet. Your play mixes offence and defence evenly.',
};
