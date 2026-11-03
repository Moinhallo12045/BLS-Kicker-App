import type { Match, MatchMode, MatchStatus } from '@/types';

export interface MatchFilters {
  mode: 'all' | MatchMode;
  status: 'all' | MatchStatus;
  onlyMine: boolean;
}
export const DEFAULT_MATCH_FILTERS: MatchFilters = { mode: 'all', status: 'all', onlyMine: false };

export function filterMatches(matches: Match[], filters: MatchFilters, currentUserId?: string, playerId?: string) {
  return matches.filter((match) => {
    const participants = [...match.teamA, ...match.teamB];
    return (!playerId || participants.includes(playerId))
      && (!filters.onlyMine || Boolean(currentUserId && participants.includes(currentUserId)))
      && (filters.mode === 'all' || match.mode === filters.mode)
      && (filters.status === 'all' || match.status === filters.status);
  });
}
