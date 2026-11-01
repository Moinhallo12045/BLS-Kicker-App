export interface LevelInfo {
  level: number;
  title: string;
  tier: 'Anfänger' | 'Amateur' | 'Fortgeschritten' | 'Profi' | 'Elite' | 'Legende';
  color: string;
  xpRequired: number; // cumulative or for this level
}

export function getTierForLevel(level: number): {
  tier: 'Anfänger' | 'Amateur' | 'Fortgeschritten' | 'Profi' | 'Elite' | 'Legende';
  color: string;
} {
  if (level <= 5) return { tier: 'Anfänger', color: '#94a3b8' };
  if (level <= 10) return { tier: 'Amateur', color: '#22c55e' };
  if (level <= 20) return { tier: 'Fortgeschritten', color: '#38bdf8' };
  if (level <= 30) return { tier: 'Profi', color: '#a855f7' };
  if (level <= 40) return { tier: 'Elite', color: '#f59e0b' };
  return { tier: 'Legende', color: '#ef4444' };
}

// XP needed to advance from level N to N+1
export function getXpForNextLevel(level: number): number {
  if (level >= 50) return 999999;
  // Scaled curve: 100 at L1, scaling up to ~1500 at L50
  return Math.round(100 + Math.pow(level, 1.6) * 18);
}

export const MATCH_XP = {
  PLAYED: 25,
  WIN: 35,
  SHUTOUT_BONUS: 20, // e.g. 10:0 or 10:1
};
