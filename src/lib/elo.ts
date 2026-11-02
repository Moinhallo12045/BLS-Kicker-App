export const DEFAULT_ELO = 1000;
export const K_FACTOR = 32;
export const MAX_SCORE = 10;

/**
 * Calculates the expected score for Team A vs Team B.
 * Uses standard logistic Elo formula.
 */
export function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculates rating change for a match.
 * @param ratingA Average ELO of Team A
 * @param ratingB Average ELO of Team B
 * @param scoreA Goals scored by Team A
 * @param scoreB Goals scored by Team B
 * @returns { changeA: number, changeB: number, isWinA: boolean }
 */
export function calculateEloChange(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  scoreB: number,
  kFactor: number = K_FACTOR
): { changeA: number; changeB: number; isWinA: boolean } {
  const expectedA = getExpectedScore(ratingA, ratingB);
  const isWinA = scoreA > scoreB;
  const actualA = isWinA ? 1 : 0;

  const delta = kFactor * (actualA - expectedA);
  const finalDelta = Math.sign(delta) * Math.round(Math.abs(delta));

  return {
    changeA: finalDelta,
    changeB: -finalDelta,
    isWinA,
  };
}

/**
 * Helper to compute team average Elo
 */
export function getAverageElo(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_ELO;
  const sum = ratings.reduce((acc, curr) => acc + curr, 0);
  return sum / ratings.length;
}
