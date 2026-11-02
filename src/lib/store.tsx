'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Player, PlayerRole, Match, Tournament, TournamentTeam, WeeklyQuest, InviteCode, MatchMode, WhitelistEntry } from '@/types';
import { supabase } from './supabaseClient';
import { rebuildLocalStatistics, weeklyQuests } from './statistics';
import { createLocalTournament, resetLocalTournamentMatch, scoreLocalTournament } from './tournaments';
import { MAX_SCORE } from './elo';
import type { Session } from '@supabase/supabase-js';

export interface ActionResult { success: boolean; message: string }
interface ProfileRow {
  id: string; name: string; avatar: string; email?: string; year_joined: number | null;
  is_external: boolean;
  created_at?: string;
  level: number; xp: number; xp_next_level: number; elo_1v1: number; elo_2v2: number;
  elo_total: number; league_points: number; wins_1v1: number; losses_1v1: number;
  wins_2v2: number; losses_2v2: number; current_streak: number; best_rank: number;
  role: PlayerRole; is_suspended: boolean; badges: string[]; elo_history: Player['eloHistory'];
}
type ProfileLookup = ProfileRow | {id: null} | null;
// A scalar composite RPC can return an object with null fields when no row exists.
const isExistingProfile = (profile: ProfileLookup): profile is ProfileRow => Boolean(profile?.id);
interface MatchRow {
  id: string; mode: MatchMode; creator_id: string; team_a: string[]; team_b: string[];
  score_a: number; score_b: number; status: Match['status']; confirmed_by: string[];
  result_applied: boolean; disputed_by?: string; dispute_reason?: string;
  dispute_proposed_score_a?: number; dispute_proposed_score_b?: number;
  dispute_proposed_by?: string; elo_change_a: number; elo_change_b: number;
  tournament_id?: string; created_at: string; cancellation_requested_by?: string;
}
interface TournamentRow {
  id: string; name: string; description: string; type: Tournament['type'];
  mode: MatchMode; status: Tournament['status']; participants: string[];
  teams?: TournamentTeam[]; matches: Tournament['matches']; created_at: string;
  winner_id?: string; winner_team_id?: string;
}
interface InviteRow {
  code: string; created_by: string; used_by: string[]; max_uses: number;
  is_active: boolean; created_at: string;
}
interface WhitelistRow { id: string; pattern: string; added_by: string; created_at: string }
interface TournamentParams {
  name: string; description: string; type: Tournament['type']; mode: MatchMode; teams: TournamentTeam[];
}
interface StoreContextType {
  currentUser: Player | null; players: Player[]; matches: Match[]; tournaments: Tournament[];
  quests: WeeklyQuest[]; inviteCodes: InviteCode[]; whitelist: WhitelistEntry[];
  syncError: string | null; isLoading: boolean; refreshState: () => Promise<void>;
  newLevelUnlocked: { player: Player; oldLevel: number; newLevel: number } | null;
  clearLevelModal: () => void; setCurrentUser: (player: Player | null) => void;
  switchUser: (playerId: string) => void;
  submitMatch: (params: {mode: MatchMode; teamA: string[]; teamB: string[]; scoreA: number; scoreB: number}) => Promise<ActionResult & {matchId: string}>;
  confirmMatch: (matchId: string, matchOverride?: Match) => void;
  acknowledgeMatch: (matchId: string) => Promise<ActionResult>;
  disputeMatch: (matchId: string, reason: string, proposedScoreA?: number, proposedScoreB?: number) => Promise<ActionResult>;
  proposeDisputeResolution: (matchId: string, scoreA: number, scoreB: number, reason?: string) => Promise<ActionResult>;
  acceptDisputeResolution: (matchId: string) => Promise<ActionResult>;
  cancelMatchByMutualAgreement: (matchId: string) => Promise<ActionResult>;
  adminResolveDispute: (matchId: string, action: 'confirm' | 'cancel', scoreA?: number, scoreB?: number) => Promise<ActionResult>;
  registerWithInvite: (params: {name: string; email: string; inviteCode: string; avatar: string}) => Promise<ActionResult>;
  loginPlayer: (nameOrEmail: string) => ActionResult;
  logout: () => Promise<ActionResult>;
  updatePlayerRole: (playerId: string, role: PlayerRole) => Promise<ActionResult>;
  setPlayerSuspension: (playerId: string, suspended: boolean) => Promise<ActionResult>;
  checkWhitelistAndSendCode: (email: string) => Promise<ActionResult & {isExistingPlayer?: boolean}>;
  verifyCode: (email: string, code: string) => Promise<ActionResult & {isExistingPlayer?: boolean}>;
  completeProfileCreation: (params: {email: string; name: string; avatar: string; yearJoined: number | null}) => Promise<ActionResult>;
  addWhitelistEntry: (pattern: string) => Promise<ActionResult>;
  removeWhitelistEntry: (id: string) => Promise<ActionResult>;
  createInviteCode: (code: string, maxUses: number) => Promise<ActionResult>;
  createTournament: (params: TournamentParams) => Promise<ActionResult & {tournamentId?: string}>;
  advanceTournamentMatch: (tournamentId: string, matchId: string, scoreA: number, scoreB: number) => Promise<ActionResult>;
  resetToDefaultData: () => void;
}
const StoreContext = createContext<StoreContextType | null>(null);
const STORAGE_KEY = 'bls_kicker_app_state_v5';
const PROFILE_COLUMNS = 'id,name,avatar,year_joined,is_external,level,xp,xp_next_level,elo_1v1,elo_2v2,elo_total,league_points,wins_1v1,losses_1v1,wins_2v2,losses_2v2,current_streak,best_rank,role,is_suspended,badges,elo_history,created_at,updated_at';
const failure = (message: string): ActionResult => ({ success: false, message });
const success = (message: string): ActionResult => ({ success: true, message });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Die Anfrage ist fehlgeschlagen.';
const profileToPlayer = (p: ProfileRow): Player => ({
  id: p.id, name: p.name, avatar: p.avatar || '⚽', email: p.email || '',
  createdAt: p.created_at,
  yearJoined: p.year_joined, isExternal: Boolean(p.is_external), level: p.level, xp: p.xp, xpNextLevel: p.xp_next_level,
  elo1v1: p.elo_1v1, elo2v2: p.elo_2v2, eloTotal: p.elo_total,
  leaguePoints: p.league_points, wins1v1: p.wins_1v1, losses1v1: p.losses_1v1,
  wins2v2: p.wins_2v2, losses2v2: p.losses_2v2, currentStreak: p.current_streak,
  bestRank: p.best_rank, role: p.role, isSuspended: p.is_suspended,
  badges: p.badges || [], eloHistory: p.elo_history || [],
});
const matchToMatch = (m: MatchRow): Match => ({
  id: m.id, mode: m.mode, creatorId: m.creator_id, teamA: m.team_a, teamB: m.team_b,
  scoreA: m.score_a, scoreB: m.score_b, status: m.status, date: m.created_at.slice(0, 10),
  createdAt: m.created_at, confirmedBy: m.confirmed_by || [], resultApplied: m.result_applied,
  disputedBy: m.disputed_by || undefined, disputeReason: m.dispute_reason || undefined,
  disputeProposedScoreA: m.dispute_proposed_score_a ?? undefined,
  disputeProposedScoreB: m.dispute_proposed_score_b ?? undefined,
  disputeProposedBy: m.dispute_proposed_by || undefined, eloChangeA: m.elo_change_a,
  eloChangeB: m.elo_change_b, tournamentId: m.tournament_id || undefined,
  cancellationRequestedBy: m.cancellation_requested_by || undefined,
});
const tournamentToTournament = (t: TournamentRow): Tournament => ({
  id: t.id, name: t.name, description: t.description || '', type: t.type, mode: t.mode,
  status: t.status, participants: t.participants || [], teams: t.teams || [],
  matches: t.matches || [], createdAt: t.created_at, winnerId: t.winner_id || undefined,
  winnerTeamId: t.winner_team_id || undefined,
});
async function readPages<T>(read: (start: number, end: number) => PromiseLike<{data: T[] | null; error: {message: string} | null}>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 250) {
    const { data, error } = await read(start, start + 249);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Die Datenbank hat keine gültige Antwort geliefert.');
    rows.push(...data);
    if (data.length < 250) return rows;
  }
}

export function StoreProvider({ children }: {children: React.ReactNode}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [isHydrated, setIsHydrated] = useState(false);
  const [newLevelUnlocked, setNewLevelUnlocked] = useState<StoreContextType['newLevelUnlocked']>(null);
  const sessionRef = useRef<Session | null>(null);
  const versionRef = useRef(0);
  const refreshRef = useRef<Promise<void> | null>(null);
  const mutationRef = useRef(false);
  const levelRef = useRef<{id: string; level: number} | null>(null);
  const stateRef = useRef({ players, matches, tournaments });
  stateRef.current = { players, matches, tournaments };

  const refreshState = useCallback(async () => {
    const client = supabase;
    if (!client || !sessionRef.current) return;
    const previous = refreshRef.current;
    const version = versionRef.current;
    const load = async () => {
      try {
        const { data: ownData, error: ownError } = await client.rpc('get_my_profile').maybeSingle().returns<ProfileLookup>();
        if (ownError) throw new Error(ownError.message);
        const own = isExistingProfile(ownData) ? ownData : null;
        const [profiles, remoteMatches, remoteTournaments] = await Promise.all([
          readPages((start, end) => client.from('profiles').select(PROFILE_COLUMNS)
            .order('created_at').order('id').range(start, end).returns<ProfileRow[]>()),
          readPages((start, end) => client.from('matches').select('*')
            .order('created_at', {ascending: false}).order('id', {ascending: false}).range(start, end).returns<MatchRow[]>()),
          readPages((start, end) => client.from('tournaments').select('*')
            .order('created_at', {ascending: false}).order('id', {ascending: false}).range(start, end).returns<TournamentRow[]>()),
        ]);
        let remoteWhitelist: WhitelistRow[] = [];
        let remoteInvites: InviteRow[] = [];
        if (own && !own.is_suspended && ['owner', 'co_owner', 'admin'].includes(own.role)) {
          [remoteWhitelist, remoteInvites] = await Promise.all([
            readPages((start, end) => client.from('whitelist').select('*').order('id').range(start, end).returns<WhitelistRow[]>()),
            readPages((start, end) => client.from('invite_codes').select('*').order('code').range(start, end).returns<InviteRow[]>()),
          ]);
        }
        if (version !== versionRef.current) return;
        const mapped = profiles.map((p) => profileToPlayer(own?.id === p.id ? own : p));
        if (own && !profiles.some((p) => p.id === own.id)) mapped.push(profileToPlayer(own));
        if (own && levelRef.current && levelRef.current.id === own.id && own.level > levelRef.current.level) {
          setNewLevelUnlocked({player: profileToPlayer(own), oldLevel: levelRef.current.level, newLevel: own.level});
        }
        levelRef.current = own ? {id: own.id, level: own.level} : null;
        setPlayers(mapped);
        setMatches(remoteMatches.map(matchToMatch));
        setTournaments(remoteTournaments.map(tournamentToTournament));
        setCurrentUserId(own?.id || null);
        setWhitelist(remoteWhitelist.map((w) => ({id: w.id, pattern: w.pattern, addedBy: w.added_by, createdAt: w.created_at})));
        setInviteCodes(remoteInvites.map((c) => ({code: c.code, createdBy: c.created_by, usedBy: c.used_by, maxUses: c.max_uses, isActive: c.is_active, createdAt: c.created_at})));
        setSyncError(own?.is_suspended ? 'Dein Spielerprofil ist gesperrt. Bitte wende dich an die Administration.' : null);
      } catch (error) {
        console.error('Synchronisierung fehlgeschlagen:', error);
        if (version === versionRef.current) setSyncError(errorMessage(error));
      } finally {
        if (version === versionRef.current) setIsLoading(false);
      }
    };
    const pending = (async () => {
      if (previous) await previous;
      await load();
    })();
    refreshRef.current = pending;
    await pending;
    if (refreshRef.current === pending) refreshRef.current = null;
  }, []);

  useEffect(() => {
    if (!supabase) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: {players?: Player[]; matches?: Match[]; tournaments?: Tournament[]; currentUserId?: string} = JSON.parse(saved);
          if (!Array.isArray(parsed.players) || !Array.isArray(parsed.matches) || !Array.isArray(parsed.tournaments)) {
            throw new Error('Ungültige lokale Spieldaten. Bitte die Demodaten zurücksetzen.');
          }
          const rebuilt = rebuildLocalStatistics(parsed.players, parsed.matches, parsed.tournaments);
          setPlayers(rebuilt.players); setMatches(rebuilt.matches); setTournaments(parsed.tournaments);
          setCurrentUserId(parsed.currentUserId || null);
        }
      } catch (error) {
        console.error('Lokale Daten konnten nicht geladen werden:', error);
        setSyncError(errorMessage(error));
        return;
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (supabase || !isHydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({players, matches, tournaments, currentUserId})); }
    catch (error) { console.error('Lokale Speicherung fehlgeschlagen:', error); setSyncError(errorMessage(error)); }
  }, [players, matches, tournaments, currentUserId, isHydrated]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const sessionVersion = versionRef;
    let active = true;
    const setSession = (session: Session | null) => {
      if (!active) return;
      const changedUser = sessionRef.current?.user.id !== session?.user.id;
      versionRef.current++;
      sessionRef.current = session;
      if (changedUser) {
        levelRef.current = null;
        setCurrentUserId(null); setPlayers([]); setMatches([]); setTournaments([]);
        setWhitelist([]); setInviteCodes([]); setNewLevelUnlocked(null);
        setIsLoading(Boolean(session));
      }
      if (!session) {
        levelRef.current = null;
        setCurrentUserId(null); setPlayers([]); setMatches([]); setTournaments([]);
        setWhitelist([]); setInviteCodes([]); setIsLoading(false); setNewLevelUnlocked(null);
      } else { void refreshState(); }
    };
    let initialResolved = false;
    client.auth.getSession().then(({data, error}) => {
      if (!active || initialResolved) return;
      if (error) { setSyncError(error.message); setIsLoading(false); return; }
      initialResolved = true;
      setSession(data.session);
    });
    const {data: listener} = client.auth.onAuthStateChange((_event, session) => {
      initialResolved = true;
      // Supabase auth callbacks must return before another authenticated query.
      setTimeout(() => setSession(session), 0);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshState();
    }, 15000);
    const resume = () => { if (document.visibilityState === 'visible') void refreshState(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      active = false; sessionVersion.current++; listener.subscription.unsubscribe(); clearInterval(timer);
      document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume);
    };
  }, [refreshState]);

  const user = players.find((p) => p.id === currentUserId) || null;
  const currentUser = user?.isSuspended ? null : user;
  const quests = weeklyQuests(matches, currentUser?.id);
  const canManage = Boolean(currentUser && ['owner', 'co_owner', 'admin', 'organiser'].includes(currentUser.role));
  const isAdmin = Boolean(currentUser && ['owner', 'co_owner', 'admin'].includes(currentUser.role));

  const updateLocal = (nextMatches: Match[], nextTournaments = stateRef.current.tournaments) => {
    const rebuilt = rebuildLocalStatistics(stateRef.current.players, nextMatches, nextTournaments);
    const old = stateRef.current.players.find((p) => p.id === currentUserId);
    const next = rebuilt.players.find((p) => p.id === currentUserId);
    if (old && next && next.level > old.level) setNewLevelUnlocked({player: next, oldLevel: old.level, newLevel: next.level});
    stateRef.current = {players: rebuilt.players, matches: rebuilt.matches, tournaments: nextTournaments};
    setPlayers(rebuilt.players); setMatches(rebuilt.matches); setTournaments(nextTournaments);
  };
  const rpcAction = async (name: string, params: Record<string, unknown>, message: string): Promise<ActionResult> => {
    if (!supabase) return failure('Die sichere Datenbankverbindung ist nicht konfiguriert.');
    if (!currentUser) return failure('Bitte melde dich mit einem aktiven Spielerprofil an.');
    if (mutationRef.current) return failure('Eine Änderung wird bereits gespeichert. Bitte kurz warten.');
    mutationRef.current = true;
    try {
      const {error} = await supabase.rpc(name, params);
      if (error) { console.error(`${name} fehlgeschlagen:`, error); return failure(error.message); }
      await refreshState();
      return success(message);
    } catch (error) {
      console.error(`${name} fehlgeschlagen:`, error);
      return failure(errorMessage(error));
    } finally { mutationRef.current = false; }
  };
  const validScore = (a: number, b: number) => Number.isInteger(a) && Number.isInteger(b)
    && a >= 0 && b >= 0 && a <= MAX_SCORE && b <= MAX_SCORE && a !== b;
  const localMatch = (id: string) => stateRef.current.matches.find((m) => m.id === id);
  const isParticipant = (m: Match) => Boolean(currentUser && [...m.teamA, ...m.teamB].includes(currentUser.id));
  const patchLocal = (id: string, patch: Partial<Match>, message: string) => {
    try {
      const match = localMatch(id);
      if (match?.tournamentId && Object.keys(patch).some((key) => key !== 'confirmedBy')) {
        if (patch.status === 'cancelled' && isAdmin) {
          const next = resetLocalTournamentMatch(stateRef.current.tournaments, stateRef.current.matches, id);
          updateLocal(next.matches, next.tournaments);
          return success(message);
        }
        return failure('Bitte Turnierspiele über die Turnierleitung im Spielplan korrigieren.');
      }
      updateLocal(stateRef.current.matches.map((m) => m.id === id ? {...m, ...patch} : m)); return success(message);
    }
    catch (error) { console.error('Lokale Wertung fehlgeschlagen:', error); return failure(errorMessage(error)); }
  };

  const submitMatch: StoreContextType['submitMatch'] = async ({mode, teamA, teamB, scoreA, scoreB}) => {
    if (!currentUser) return {...failure('Nicht angemeldet.'), matchId: ''};
    if (!validScore(scoreA, scoreB)) return {...failure(`Bitte unterschiedliche ganze Torzahlen zwischen 0 und ${MAX_SCORE} eingeben.`), matchId: ''};
    const size = mode === '1v1' ? 1 : 2;
    if (teamA.length !== size || teamB.length !== size || new Set([...teamA, ...teamB]).size !== size * 2
      || ![...teamA, ...teamB].includes(currentUser.id)
      || [...teamA, ...teamB].some((id) => !players.some((p) => p.id === id && !p.isSuspended))) {
      return {...failure('Bitte unterschiedliche, aktive Spieler für beide Teams auswählen.'), matchId: ''};
    }
    if (supabase) {
      if (mutationRef.current) return {...failure('Das Spiel wird bereits gespeichert.'), matchId: ''};
      mutationRef.current = true;
      try {
        const {data, error} = await supabase.rpc('submit_match_result', {
          p_mode: mode, p_team_a: teamA, p_team_b: teamB, p_score_a: scoreA, p_score_b: scoreB,
        }).single().returns<MatchRow>();
        if (error || !data) { console.error('Spiel konnte nicht gespeichert werden:', error); return {...failure(error?.message || 'Keine Spielantwort erhalten.'), matchId: ''}; }
        await refreshState();
        return {...success('Spiel gespeichert und gewertet.'), matchId: data.id};
      } catch (error) { console.error('Spielanfrage fehlgeschlagen:', error); return {...failure(errorMessage(error)), matchId: ''}; }
      finally { mutationRef.current = false; }
    }
    const createdAt = new Date().toISOString();
    const match: Match = {id: crypto.randomUUID(), mode, creatorId: currentUser.id, teamA, teamB, scoreA, scoreB,
      createdAt, date: createdAt.slice(0, 10), status: 'confirmed', confirmedBy: [currentUser.id],
      resultApplied: true, eloChangeA: 0, eloChangeB: 0};
    try { updateLocal([match, ...stateRef.current.matches]); return {...success('Spiel lokal gespeichert und gewertet.'), matchId: match.id}; }
    catch (error) { console.error('Lokale Wertung fehlgeschlagen:', error); return {...failure(errorMessage(error)), matchId: ''}; }
  };
  const confirmMatch = (id: string, override?: Match) => {
    if (supabase) return;
    const match = override || localMatch(id);
    if (!match || !isParticipant(match)) return;
    const result = patchLocal(id, {status: 'confirmed', resultApplied: true}, 'Spiel gewertet.');
    if (!result.success) setSyncError(result.message);
  };
  const acknowledgeMatch = async (id: string) => {
    if (supabase) return rpcAction('acknowledge_match', {p_match_id: id}, 'Ergebnis als gesehen markiert.');
    const match = localMatch(id);
    if (!match || !isParticipant(match)) return failure('Keine Berechtigung.');
    return patchLocal(id, {confirmedBy: [...new Set([...match.confirmedBy, currentUser!.id])]}, 'Ergebnis als gesehen markiert.');
  };
  const disputeMatch = async (id: string, reason: string, scoreA?: number, scoreB?: number) => {
    if (!reason.trim()) return failure('Bitte eine Begründung eingeben.');
    if (supabase) return rpcAction('dispute_match', {p_match_id: id, p_reason: reason, p_score_a: scoreA ?? null, p_score_b: scoreB ?? null}, 'Widerspruch gespeichert.');
    const match = localMatch(id);
    if (!match || !isParticipant(match) || match.status === 'cancelled') return failure('Keine Berechtigung.');
    if ((scoreA === undefined) !== (scoreB === undefined) || (scoreA !== undefined && !validScore(scoreA, scoreB!))) return failure('Ungültiger Gegenvorschlag.');
    return patchLocal(id, {status: 'disputed', disputedBy: currentUser!.id, disputeReason: reason.trim(),
      disputeProposedBy: currentUser!.id, disputeProposedScoreA: scoreA, disputeProposedScoreB: scoreB}, 'Widerspruch gespeichert.');
  };
  const proposeDisputeResolution = async (id: string, a: number, b: number, reason?: string) => {
    if (!validScore(a, b)) return failure('Ungültiger Gegenvorschlag.');
    if (supabase) return rpcAction('propose_dispute_resolution', {p_match_id: id, p_score_a: a, p_score_b: b, p_reason: reason || ''}, 'Gegenvorschlag gespeichert.');
    const match = localMatch(id);
    if (!match || !isParticipant(match) || match.status !== 'disputed') return failure('Keine Berechtigung.');
    return patchLocal(id, {disputeProposedScoreA: a, disputeProposedScoreB: b, disputeProposedBy: currentUser!.id, disputeReason: reason || match.disputeReason}, 'Gegenvorschlag gespeichert.');
  };
  const acceptDisputeResolution = async (id: string) => {
    const match = localMatch(id);
    if (!match || !isParticipant(match) || match.status !== 'disputed' || !match.disputeProposedBy
      || match.teamA.includes(match.disputeProposedBy) === match.teamA.includes(currentUser!.id)) return failure('Nur die Gegenseite kann den Vorschlag annehmen.');
    if (match.disputeProposedScoreA === undefined || match.disputeProposedScoreB === undefined
      || !validScore(match.disputeProposedScoreA, match.disputeProposedScoreB)) return failure('Es liegt kein gültiger Ergebnisvorschlag vor.');
    if (supabase) return rpcAction('accept_dispute_resolution', {p_match_id: id,
      p_score_a: match.disputeProposedScoreA, p_score_b: match.disputeProposedScoreB, p_proposed_by: match.disputeProposedBy}, 'Ergebnis korrigiert und neu gewertet.');
    return patchLocal(id, {status: 'confirmed', scoreA: match.disputeProposedScoreA, scoreB: match.disputeProposedScoreB}, 'Ergebnis korrigiert und neu gewertet.');
  };
  const cancelMatchByMutualAgreement = async (id: string) => {
    if (supabase) return rpcAction('cancel_match', {p_match_id: id}, 'Streichungsanfrage gespeichert bzw. bestätigt.');
    const match = localMatch(id);
    if (!match || (!isAdmin && !isParticipant(match))) return failure('Keine Berechtigung.');
    const approved = isAdmin || (match.cancellationRequestedBy
      && match.teamA.includes(match.cancellationRequestedBy) !== match.teamA.includes(currentUser!.id));
    return patchLocal(id, approved ? {status: 'cancelled', resultApplied: false, cancellationRequestedBy: undefined}
      : {cancellationRequestedBy: currentUser!.id}, approved ? 'Spiel annulliert; Statistiken neu berechnet.' : 'Die Gegenseite muss die Streichung bestätigen.');
  };
  const adminResolveDispute = async (id: string, action: 'confirm' | 'cancel', a?: number, b?: number) => {
    if (!isAdmin) return failure('Keine Admin-Berechtigung.');
    if (action === 'confirm' && (a !== undefined || b !== undefined) && !validScore(a!, b!)) return failure('Ungültiges Ergebnis.');
    if (supabase) return rpcAction('admin_resolve_dispute', {p_match_id: id,
      p_action: action === 'confirm' && a !== undefined ? 'correct' : action,
      p_score_a: a ?? null, p_score_b: b ?? null}, 'Admin-Entscheidung gespeichert.');
    const match = localMatch(id);
    if (!match || (action === 'confirm' && (a !== undefined || b !== undefined) && !validScore(a!, b!))) return failure('Ungültiges Ergebnis.');
    return patchLocal(id, action === 'cancel' ? {status: 'cancelled', resultApplied: false}
      : {status: 'confirmed', scoreA: a ?? match.scoreA, scoreB: b ?? match.scoreB}, 'Admin-Entscheidung gespeichert.');
  };
  const checkWhitelistAndSendCode = async (email: string) => {
    if (!supabase) return failure('Die sichere Authentifizierung ist nicht konfiguriert.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return failure('Bitte eine gültige E-Mail-Adresse eingeben.');
    const {error} = await supabase.auth.signInWithOtp({email: email.trim().toLowerCase(), options: {shouldCreateUser: true}});
    return error ? failure(error.message) : success('Verifikationscode angefordert. Bitte prüfe auch den Spam-Ordner.');
  };
  const verifyCode = async (email: string, code: string) => {
    if (!supabase) return failure('Die sichere Authentifizierung ist nicht konfiguriert.');
    const {data, error} = await supabase.auth.verifyOtp({email: email.trim().toLowerCase(), token: code.trim(), type: 'email'});
    if (error) return failure('Ungültiger oder abgelaufener Code.');
    sessionRef.current = data.session; versionRef.current++;
    const {data: ownData, error: ownError} = await supabase.rpc('get_my_profile').maybeSingle().returns<ProfileLookup>();
    if (ownError) return failure(ownError.message);
    const own = isExistingProfile(ownData) ? ownData : null;
    if (own?.is_suspended) return failure('Dein Spielerprofil ist gesperrt.');
    await refreshState();
    return {...success(own ? 'Erfolgreich angemeldet.' : 'Bitte erstelle dein Spielerprofil.'), isExistingPlayer: Boolean(own)};
  };
  const completeProfileCreation: StoreContextType['completeProfileCreation'] = async ({email, name, avatar, yearJoined}) => {
    if (!supabase) return failure('Die sichere Authentifizierung ist nicht konfiguriert.');
    const {data: session, error: sessionError} = await supabase.auth.getSession();
    if (sessionError) return failure(sessionError.message);
    if (session.session?.user.email?.toLowerCase() !== email.trim().toLowerCase()) return failure('Bitte bestätige zuerst deine E-Mail-Adresse.');
    const {data: profile, error} = await supabase.rpc('create_player_profile', {p_name: name.trim(), p_avatar: avatar, p_year_joined: yearJoined}).single().returns<ProfileRow>();
    if (error || !profile) return failure(error?.message || 'Profil konnte nicht erstellt werden.');
    sessionRef.current = session.session;
    setCurrentUserId(profile.id); setPlayers((prev) => [...prev.filter((p) => p.id !== profile.id), profileToPlayer(profile)]);
    await refreshState();
    return success('Profil erfolgreich erstellt.');
  };
  const updatePlayerRole = async (id: string, role: PlayerRole) => {
    if (supabase) return rpcAction('set_player_role', {p_player_id: id, p_role: role}, 'Rolle aktualisiert.');
    if (!currentUser || !['owner', 'co_owner'].includes(currentUser.role)) return failure('Keine Berechtigung.');
    const target = players.find((p) => p.id === id);
    if (!target || (currentUser.role === 'co_owner' && (id === currentUser.id || target.role === 'owner' || role === 'owner'))) return failure('Diese Rollenänderung ist nicht erlaubt.');
    setPlayers((prev) => prev.map((p) => p.id === id ? {...p, role} : p)); return success('Rolle aktualisiert.');
  };
  const setPlayerSuspension = async (id: string, suspended: boolean) => {
    if (supabase) return rpcAction('set_player_suspension', {p_player_id: id, p_suspended: suspended}, 'Sperrstatus aktualisiert.');
    if (!isAdmin || id === currentUser?.id || players.find((p) => p.id === id)?.role === 'owner') return failure('Diese Sperränderung ist nicht erlaubt.');
    setPlayers((prev) => prev.map((p) => p.id === id ? {...p, isSuspended: suspended} : p)); return success('Sperrstatus aktualisiert.');
  };
  const addWhitelistEntry = async (pattern: string) => rpcAction('add_whitelist_entry', {p_pattern: pattern.trim().toLowerCase()}, 'Whitelist-Eintrag gespeichert.');
  const removeWhitelistEntry = async (id: string) => rpcAction('remove_whitelist_entry', {p_entry_id: id}, 'Whitelist-Eintrag entfernt.');
  const createInviteCode = async (code: string, maxUses: number) => rpcAction('create_invite_code', {p_code: code.trim().toUpperCase(), p_max_uses: maxUses}, 'Einladungscode auf dem Server gespeichert.');
  const registerWithInvite: StoreContextType['registerWithInvite'] = async () =>
    failure('Einladungscodes ersetzen keine E-Mail-Freigabe. Bitte zuerst über die Whitelist und den E-Mail-Code anmelden.');
  const loginPlayer = (value: string) => {
    if (supabase) return failure('Bitte melde dich mit deinem E-Mail-Code an.');
    const p = players.find((p) => p.name.toLowerCase() === value.toLowerCase() || p.email.toLowerCase() === value.toLowerCase());
    if (!p || p.isSuspended) return failure('Kein aktives Spielerprofil gefunden.');
    setCurrentUserId(p.id); return success('Lokal angemeldet.');
  };
  const logout = async () => {
    if (supabase) {
      const {error} = await supabase.auth.signOut();
      if (error) return failure(error.message);
    }
    versionRef.current++; sessionRef.current = null; levelRef.current = null;
    setCurrentUserId(null); setNewLevelUnlocked(null);
    if (supabase) {setPlayers([]); setMatches([]); setTournaments([]); setWhitelist([]); setInviteCodes([]);}
    return success('Abgemeldet.');
  };
  const createTournament = async (params: TournamentParams) => {
    if (!canManage) return failure('Nur Turnierleitung und Administration können Turniere erstellen.');
    if (supabase) {
      if (mutationRef.current) return failure('Eine Änderung wird bereits gespeichert.');
      mutationRef.current = true;
      try {
        const {data, error} = await supabase.rpc('create_tournament', {p_name: params.name, p_description: params.description,
          p_type: params.type, p_mode: params.mode, p_teams: params.teams}).single().returns<TournamentRow>();
        if (error || !data) {console.error('Turniererstellung fehlgeschlagen:', error); return failure(error?.message || 'Keine Turnierantwort erhalten.');}
        await refreshState(); return {...success('Turnier gespeichert.'), tournamentId: data.id};
      } catch (error) {console.error('Turniererstellung fehlgeschlagen:', error); return failure(errorMessage(error));}
      finally {mutationRef.current = false;}
    }
    try {
      const tournament = createLocalTournament(params, players);
      updateLocal(stateRef.current.matches, [tournament, ...stateRef.current.tournaments]);
      return {...success('Turnier lokal gespeichert.'), tournamentId: tournament.id};
    } catch (error) {console.error('Turniererstellung fehlgeschlagen:', error); return failure(errorMessage(error));}
  };
  const advanceTournamentMatch = async (id: string, matchId: string, a: number, b: number) => {
    if (!canManage) return failure('Nur Turnierleitung und Administration können Turnierergebnisse speichern.');
    if (supabase) return rpcAction('score_tournament_match', {p_tournament_id: id, p_match_id: matchId, p_score_a: a, p_score_b: b}, 'Turnierergebnis gespeichert.');
    const tournament = stateRef.current.tournaments.find((t) => t.id === id);
    if (tournament?.participants.some((playerId) => !stateRef.current.players.some((p) => p.id === playerId && !p.isSuspended))) {
      return failure('Das Turnier enthält unbekannte oder gesperrte Spieler.');
    }
    try {
      const next = scoreLocalTournament(stateRef.current.tournaments, stateRef.current.matches, id, matchId, a, b, currentUser!.id);
      updateLocal(next.matches, next.tournaments); return success('Turnierergebnis lokal gespeichert.');
    } catch (error) {console.error('Turnierwertung fehlgeschlagen:', error); return failure(errorMessage(error));}
  };
  const resetToDefaultData = () => {
    if (supabase) {setSyncError('Produktive Daten können hier nicht zurückgesetzt werden.'); return;}
    setPlayers([]); setMatches([]); setTournaments([]); setCurrentUserId(null); setSyncError(null);
    setIsHydrated(true);
    localStorage.removeItem(STORAGE_KEY);
  };

  return <StoreContext.Provider value={{
    currentUser, players, matches, tournaments, quests, whitelist, inviteCodes, syncError, isLoading, refreshState,
    newLevelUnlocked, clearLevelModal: () => setNewLevelUnlocked(null),
    setCurrentUser: (p) => {if (!supabase || p?.id === currentUserId) setCurrentUserId(p?.id || null);},
    switchUser: (id) => {if (!supabase) setCurrentUserId(id);},
    submitMatch, confirmMatch, acknowledgeMatch, disputeMatch, proposeDisputeResolution,
    acceptDisputeResolution, cancelMatchByMutualAgreement, adminResolveDispute,
    checkWhitelistAndSendCode, verifyCode, completeProfileCreation, updatePlayerRole,
    setPlayerSuspension, addWhitelistEntry, removeWhitelistEntry, createInviteCode,
    registerWithInvite, loginPlayer, logout, createTournament, advanceTournamentMatch, resetToDefaultData,
  }}>{children}</StoreContext.Provider>;
}
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
