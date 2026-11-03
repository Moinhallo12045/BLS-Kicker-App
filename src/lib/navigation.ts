export const TABS = ['dashboard', 'ranking', 'matches', 'tournaments', 'players', 'profile', 'features', 'admin'] as const;
export type TabType = typeof TABS[number];
export const RANKING_FILTERS = ['elo', 'krabbler', 'wochen', 'level', 'aktiv', '1v1', '2v2', 'monat', 'turnier', 'historie'] as const;
export type RankingFilter = typeof RANKING_FILTERS[number];
export interface AppLocation {
  tab: TabType;
  ranking: RankingFilter;
  playerId?: string;
  matchId?: string;
  tournamentId?: string;
}

export function parseLocation(hash: string): AppLocation {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const tab = TABS.find((value) => value === params.get('tab')) || 'dashboard';
  const ranking = RANKING_FILTERS.find((value) => value === params.get('ranking')) || 'elo';
  const playerId = params.get('player') || undefined;
  return { tab, ranking, playerId, matchId: playerId ? undefined : params.get('match') || undefined, tournamentId: params.get('tournament') || undefined };
}

export function locationHash(location: AppLocation): string {
  const params = new URLSearchParams({ tab: location.tab });
  if (location.tab === 'ranking') params.set('ranking', location.ranking);
  if (location.tournamentId) params.set('tournament', location.tournamentId);
  if (location.playerId) params.set('player', location.playerId);
  else if (location.matchId) params.set('match', location.matchId);
  return `#${params}`;
}
