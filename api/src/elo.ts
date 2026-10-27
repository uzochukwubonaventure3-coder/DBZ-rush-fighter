export const K_FACTOR = 32;
export const START_RATING = 1200;

export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Zero-sum: B's change is exactly minus A's, so rounding never creates or destroys rating points. */
export function eloUpdate(ratingA: number, ratingB: number, aWon: boolean): { deltaA: number; deltaB: number } {
  const deltaA = Math.round(K_FACTOR * ((aWon ? 1 : 0) - expectedScore(ratingA, ratingB)));
  return { deltaA, deltaB: -deltaA };
}
