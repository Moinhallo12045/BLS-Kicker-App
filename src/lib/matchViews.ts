import { Match, Player, Tournament } from '@/types';
import { useStore } from '@/lib/store';
import { isScoredMatch, qualifiedPlayers } from '@/lib/statistics';
import { MAX_SCORE } from './elo';

export { daysAgoKey, getMonthStartKey, getWeekStartKey, toDateKey } from './dates';

export const MIN_RANKED_GAMES = 3;
export { MAX_SCORE } from './elo';
export const UNRANKED_BEST_RANK = 999;
export const MAX_LEVEL = 50;
export const ADMIN_ROLES = ['owner', 'co_owner', 'admin'] as const;

export type ActionResult = { success: boolean; message: string };

export function isAdminRole(role?: string | null): boolean {
  return Boolean(role && (ADMIN_ROLES as readonly string[]).includes(role));
}

/** A match counts for statistics when applied and not cancelled (legacy: confirmed). */
export const isMatchCounted = isScoredMatch;

export function teamOf(match: Match, playerId?: string | null): 'A' | 'B' | null {
  if (!playerId) return null;
  if (match.teamA.includes(playerId)) return 'A';
  if (match.teamB.includes(playerId)) return 'B';
  return null;
}

export function isOpposingSide(match: Match, playerA?: string | null, playerB?: string | null): boolean {
  const a = teamOf(match, playerA);
  const b = teamOf(match, playerB);
  return a !== null && b !== null && a !== b;
}

export function didPlayerWin(match: Match, playerId: string): boolean {
  const side = teamOf(match, playerId);
  if (side === 'A') return match.scoreA > match.scoreB;
  if (side === 'B') return match.scoreB > match.scoreA;
  return false;
}

/** Cancellation state from the perspective of the given player. */
export function getCancellationState(
  match: Match,
  playerId?: string | null
): 'none' | 'requested_by_my_side' | 'awaiting_my_approval' | 'requested' {
  const requester = match.cancellationRequestedBy;
  if (!requester || match.status === 'cancelled') return 'none';
  const mine = teamOf(match, playerId);
  const theirs = teamOf(match, requester);
  if (!mine || !theirs) return 'requested';
  return mine === theirs ? 'requested_by_my_side' : 'awaiting_my_approval';
}

/** Matches the user still has to look at or act on (league games only). */
export function getActionableMatches(matches: Match[], playerId?: string | null) {
  if (!playerId) return { pending: [] as Match[], disputed: [] as Match[], cancellations: [] as Match[], total: 0 };
  const mine = matches.filter((m) => !m.tournamentId && teamOf(m, playerId) !== null);
  const pending = mine.filter(
    (m) => (m.status === 'pending' || m.status === 'confirmed') && !m.confirmedBy.includes(playerId)
  );
  const disputed = mine.filter((m) => m.status === 'disputed');
  const cancellations = mine.filter(
    (m) =>
      m.status !== 'disputed' &&
      !pending.includes(m) &&
      getCancellationState(m, playerId) === 'awaiting_my_approval'
  );
  return { pending, disputed, cancellations, total: pending.length + disputed.length + cancellations.length };
}

export function gamesPlayed(player: Player): number {
  return player.wins1v1 + player.losses1v1 + player.wins2v2 + player.losses2v2;
}

export function isQualified(player: Player): boolean {
  return gamesPlayed(player) >= MIN_RANKED_GAMES;
}

export function getQualifiedByElo(players: Player[]): Player[] {
  return qualifiedPlayers(players.filter((p) => !p.isDeleted));
}

/** Rank in the ELO ladder, or null when the player is not (yet) qualified. */
export function getLeagueRank(players: Player[], playerId: string): number | null {
  const index = getQualifiedByElo(players).findIndex((p) => p.id === playerId);
  return index >= 0 ? index + 1 : null;
}

export function formatBestRank(bestRank?: number | null): string {
  if (!bestRank || bestRank <= 0 || bestRank >= UNRANKED_BEST_RANK) return '--';
  return `#${bestRank}`;
}

export interface PeriodStats {
  games: number;
  wins: number;
  points: number;
}

/** League points (3 per win) and games from counted matches since a date key. */
export function computePeriodStats(matches: Match[], sinceKey: string): Map<string, PeriodStats> {
  const stats = new Map<string, PeriodStats>();
  matches
    .filter((m) => isMatchCounted(m) && m.date >= sinceKey)
    .forEach((m) => {
      [...m.teamA, ...m.teamB].forEach((playerId) => {
        const current = stats.get(playerId) || { games: 0, wins: 0, points: 0 };
        const won = didPlayerWin(m, playerId);
        stats.set(playerId, {
          games: current.games + 1,
          wins: current.wins + (won ? 1 : 0),
          points: current.points + (won ? 3 : 0),
        });
      });
    });
  return stats;
}

/** Tournament titles per player, supporting team winners and legacy player winners. */
export function computeTournamentWins(tournaments: Tournament[]): Map<string, number> {
  const wins = new Map<string, number>();
  const credit = (id: string) => wins.set(id, (wins.get(id) || 0) + 1);
  tournaments.forEach((t) => {
    if (t.status !== 'completed') return;
    const winningTeam = t.winnerTeamId ? t.teams?.find((team) => team.id === t.winnerTeamId) : undefined;
    if (winningTeam) {
      winningTeam.playerIds.forEach(credit);
    } else if (t.winnerId && t.participants.includes(t.winnerId)) {
      credit(t.winnerId);
    }
  });
  return wins;
}

/** Parses a score input. Returns null for empty / non-integer input. */
export function parseScore(value: string | number): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Validates a final score. Returns a German error message or null when valid. */
export function validateScore(scoreA: number | null, scoreB: number | null): string | null {
  if (scoreA === null || scoreB === null) return 'Bitte für beide Seiten ganze Zahlen als Tore eingeben.';
  if (scoreA < 0 || scoreB < 0) return 'Negative Tore sind nicht möglich.';
  if (scoreA > MAX_SCORE || scoreB > MAX_SCORE) return `Maximal ${MAX_SCORE} Tore pro Seite.`;
  if (scoreA === scoreB) return 'Beim Tischkicker gibt es kein Unentschieden.';
  return null;
}

function isActionResult(value: unknown): value is { success: boolean; message?: unknown } {
  return Boolean(value) && typeof value === 'object' && typeof (value as { success?: unknown }).success === 'boolean';
}

/**
 * Executes a store mutation and normalises its outcome. Mutations must resolve
 * to { success, message }; anything else is reported as a failure unless
 * voidIsSuccess is set (e.g. for logout).
 */
export async function runAction(
  action: () => unknown,
  options: { fallbackError: string; successMessage?: string; voidIsSuccess?: boolean }
): Promise<ActionResult> {
  try {
    const value = await action();
    if (isActionResult(value)) {
      const message = typeof value.message === 'string' && value.message.trim() ? value.message : '';
      return {
        success: value.success,
        message: message || (value.success ? options.successMessage || 'Erledigt.' : options.fallbackError),
      };
    }
    if (value === undefined && options.voidIsSuccess) {
      return { success: true, message: options.successMessage || 'Erledigt.' };
    }
    return { success: false, message: `${options.fallbackError} (keine Rückmeldung vom Server)` };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : options.fallbackError;
    return { success: false, message };
  }
}

/** Reads the store's sync contract (syncError / isLoading / refreshState). */
export function useSyncState() {
  const { syncError, isLoading, refreshState } = useStore();
  return { syncError, isLoading, refreshState };
}

export function playerNames(players: Player[], ids: string[], fallback = 'Unbekannt'): string {
  return ids.map((id) => players.find((p) => p.id === id)?.name || fallback).join(' & ');
}
