'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppLocation, locationHash, parseLocation, RankingFilter, TabType } from '@/lib/navigation';
import { MatchFilters } from '@/lib/matchFilters';

interface NavigationContext {
  location: AppLocation;
  selectTab: (tab: TabType, ranking?: RankingFilter) => void;
  openPlayer: (id: string) => void;
  openMatch: (id: string) => void;
  openTournament: (id: string) => void;
  back: () => void;
  matchFilters: Record<string, MatchFilters>;
  setMatchFilters: (key: string, value: MatchFilters) => void;
  comparisons: Record<string, string>;
  setComparison: (key: string, id: string) => void;
}
const Context = createContext<NavigationContext | null>(null);

export function AppNavigation({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<AppLocation>({ tab: 'dashboard', ranking: 'elo' });
  const depth = useRef(0);
  const [matchFilters, updateMatchFilters] = useState<Record<string, MatchFilters>>({});
  const [comparisons, updateComparisons] = useState<Record<string, string>>({});

  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const restore = () => {
      depth.current = history.state?.kickerDepth || 0;
      setLocation(parseLocation(window.location.hash));
      requestAnimationFrame(() => window.scrollTo(0, history.state?.kickerScroll || 0));
    };
    restore();
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => {
      history.scrollRestoration = previousRestoration;
      window.removeEventListener('popstate', restore);
      window.removeEventListener('hashchange', restore);
    };
  }, []);

  const navigate = (next: AppLocation) => {
    if (locationHash(next) === window.location.hash) return;
    history.replaceState({ ...history.state, kickerScroll: window.scrollY, kickerDepth: depth.current }, '');
    depth.current += 1;
    history.pushState({ kickerDepth: depth.current, kickerScroll: 0 }, '', locationHash(next));
    setLocation(next);
    window.scrollTo(0, 0);
  };
  const selectTab = (tab: TabType, ranking: RankingFilter = location.ranking) =>
    navigate({ tab, ranking, tournamentId: location.tournamentId });

  return <Context.Provider value={{
    location, selectTab,
    matchFilters,
    setMatchFilters: (key, value) => updateMatchFilters((previous) => ({ ...previous, [key]: value })),
    comparisons,
    setComparison: (key, id) => updateComparisons((previous) => ({ ...previous, [key]: id })),
    openPlayer: (playerId) => navigate({ ...location, playerId, matchId: undefined }),
    openMatch: (matchId) => navigate({ ...location, matchId, playerId: undefined }),
    openTournament: (tournamentId) => navigate({ tab: 'tournaments', ranking: location.ranking, tournamentId }),
    back: () => depth.current > 0 ? history.back() : selectTab(location.tab),
  }}>{children}</Context.Provider>;
}

export function useAppNavigation() {
  const context = useContext(Context);
  if (!context) throw new Error('AppNavigation fehlt.');
  return context;
}

export function PlayerLink({ id, children }: { id: string; children: React.ReactNode }) {
  const { openPlayer } = useAppNavigation();
  return <button type="button" onClick={() => openPlayer(id)} className="min-h-[44px] text-left hover:text-amber-300 underline-offset-2 hover:underline">{children}</button>;
}
