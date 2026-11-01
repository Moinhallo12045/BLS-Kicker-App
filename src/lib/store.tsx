'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Player, PlayerRole, Match, Tournament, WeeklyQuest, InviteCode, MatchMode, WhitelistEntry } from '@/types';
import { 
  INITIAL_PLAYERS, 
  INITIAL_MATCHES, 
  INITIAL_TOURNAMENTS, 
  INITIAL_INVITE_CODES,
  INITIAL_WHITELIST 
} from './mockData';
import { INITIAL_WEEKLY_QUESTS } from './badges';
import { calculateEloChange, getAverageElo } from './elo';
import { getXpForNextLevel, MATCH_XP } from './levels';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

interface StoreContextType {
  currentUser: Player | null;
  players: Player[];
  matches: Match[];
  tournaments: Tournament[];
  quests: WeeklyQuest[];
  inviteCodes: InviteCode[];
  whitelist: WhitelistEntry[];
  newLevelUnlocked: { player: Player; oldLevel: number; newLevel: number } | null;
  clearLevelModal: () => void;
  setCurrentUser: (player: Player | null) => void;
  switchUser: (playerId: string) => void;
  submitMatch: (params: {
    mode: MatchMode;
    teamA: string[];
    teamB: string[];
    scoreA: number;
    scoreB: number;
  }) => Promise<{ success: boolean; matchId: string; message: string }>;
  confirmMatch: (matchId: string, matchOverride?: Match) => void;
  acknowledgeMatch: (matchId: string) => Promise<void>;
  disputeMatch: (matchId: string, reason: string, proposedScoreA?: number, proposedScoreB?: number) => Promise<void>;
  proposeDisputeResolution: (matchId: string, proposedScoreA: number, proposedScoreB: number, reason?: string) => Promise<void>;
  acceptDisputeResolution: (matchId: string) => Promise<void>;
  cancelMatchByMutualAgreement: (matchId: string) => Promise<void>;
  adminResolveDispute: (matchId: string, action: 'confirm' | 'cancel', adjustedScoreA?: number, adjustedScoreB?: number) => Promise<void>;
  registerWithInvite: (params: { name: string; email: string; inviteCode: string; avatar: string }) => Promise<{ success: boolean; message: string }>;
  loginPlayer: (nameOrEmail: string) => { success: boolean; message: string };
  logout: () => Promise<void>;
  updatePlayerRole: (playerId: string, newRole: PlayerRole) => Promise<void>;
  setPlayerSuspension: (playerId: string, suspended: boolean) => Promise<{ success: boolean; message: string }>;
  // Email Whitelist & Verification Flow
  checkWhitelistAndSendCode: (email: string) => Promise<{ success: boolean; message: string; isExistingPlayer?: boolean }>;
  verifyCode: (email: string, code: string) => Promise<{ success: boolean; message: string; isExistingPlayer?: boolean }>;
  completeProfileCreation: (params: { email: string; name: string; avatar: string; yearJoined: number }) => Promise<{ success: boolean; message: string }>;
  addWhitelistEntry: (pattern: string) => Promise<{ success: boolean; message: string }>;
  removeWhitelistEntry: (id: string) => Promise<{ success: boolean; message: string }>;
  createInviteCode: (code: string, maxUses: number) => { success: boolean; message: string };
  createTournament: (params: { name: string; description: string; type: 'ko' | 'groups' | 'round_robin'; mode: MatchMode; participants: string[] }) => void;
  advanceTournamentMatch: (tournamentId: string, matchId: string, scoreA: number, scoreB: number) => void;
  resetToDefaultData: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEY = 'bls_kicker_app_state_v5';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [tournaments, setTournaments] = useState<Tournament[]>(INITIAL_TOURNAMENTS);
  const [quests, setQuests] = useState<WeeklyQuest[]>(INITIAL_WEEKLY_QUESTS);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>(INITIAL_INVITE_CODES);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>(INITIAL_WHITELIST);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authIdentity, setAuthIdentity] = useState<{ email: string; role: PlayerRole } | null>(null);
  const [newLevelUnlocked, setNewLevelUnlocked] = useState<{ player: Player; oldLevel: number; newLevel: number } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.players) setPlayers(parsed.players);
        if (parsed.matches) setMatches(parsed.matches);
        if (parsed.tournaments) setTournaments(parsed.tournaments);
        if (parsed.quests) setQuests(parsed.quests);
        if (parsed.inviteCodes) setInviteCodes(parsed.inviteCodes);
        if (parsed.whitelist) setWhitelist(parsed.whitelist);
        if (parsed.currentUserId && !supabase) setCurrentUserId(parsed.currentUserId);
      }
    } catch (e) {
      console.warn('Failed to parse localStorage state:', e);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const isAdminIdentity = authIdentity && (
      authIdentity.role === 'owner' ||
      authIdentity.role === 'co_owner' ||
      authIdentity.role === 'admin'
    );
    if (!supabase || !isAdminIdentity) return;

    supabase
      .from('whitelist')
      .select('id, pattern, added_by, created_at')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        setWhitelist(
          data.map((entry) => ({
            id: entry.id,
            pattern: entry.pattern,
            addedBy: entry.added_by,
            createdAt: entry.created_at.slice(0, 10),
          }))
        );
      });
  }, [authIdentity]);

  useEffect(() => {
    const client = supabase;
    if (!client || !authIdentity) return;

    const loadRemoteState = async () => {
      const [{ data: remoteProfiles }, { data: remoteMatches }, { data: remoteTournaments }] =
        await Promise.all([
          client.from('profiles').select('*').order('created_at', { ascending: true }),
          client.from('matches').select('*').order('created_at', { ascending: false }),
          client.from('tournaments').select('*').order('created_at', { ascending: false }),
        ]);

      if (remoteProfiles) {
        setPlayers(remoteProfiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar || '⚽',
          email: profile.email || '',
          yearJoined: profile.year_joined,
          level: profile.level,
          xp: profile.xp,
          xpNextLevel: profile.xp_next_level,
          elo1v1: profile.elo_1v1,
          elo2v2: profile.elo_2v2,
          eloTotal: profile.elo_total,
          leaguePoints: profile.league_points,
          wins1v1: profile.wins_1v1,
          losses1v1: profile.losses_1v1,
          wins2v2: profile.wins_2v2,
          losses2v2: profile.losses_2v2,
          currentStreak: profile.current_streak,
          bestRank: profile.best_rank,
          role: profile.role as PlayerRole,
          isSuspended: profile.is_suspended ?? false,
          badges: profile.badges || [],
          eloHistory: profile.elo_history || [],
        })));
      }
      if (remoteMatches) {
        setMatches(remoteMatches.map((match) => ({
          id: match.id,
          mode: match.mode as MatchMode,
          date: match.created_at.slice(0, 10),
          creatorId: match.creator_id,
          teamA: match.team_a,
          teamB: match.team_b,
          scoreA: match.score_a,
          scoreB: match.score_b,
          status: match.status,
          confirmedBy: match.confirmed_by || [],
          resultApplied: match.result_applied ?? match.status === 'confirmed',
          disputedBy: match.disputed_by || undefined,
          disputeReason: match.dispute_reason || undefined,
          disputeProposedScoreA: match.dispute_proposed_score_a ?? undefined,
          disputeProposedScoreB: match.dispute_proposed_score_b ?? undefined,
          disputeProposedBy: match.dispute_proposed_by || undefined,
          eloChangeA: match.elo_change_a || 0,
          eloChangeB: match.elo_change_b || 0,
          tournamentId: match.tournament_id || undefined,
        })));
      }
      if (remoteTournaments) {
        setTournaments(remoteTournaments.map((tournament) => ({
          id: tournament.id,
          name: tournament.name,
          description: tournament.description || '',
          type: tournament.type,
          mode: tournament.mode,
          status: tournament.status,
          participants: tournament.participants || [],
          createdAt: tournament.created_at.slice(0, 10),
          matches: tournament.matches || [],
          winnerId: tournament.winner_id || undefined,
        })));
      }
    };

    void loadRemoteState();
  }, [authIdentity]);

  // Save to localStorage on change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          players,
          matches,
          tournaments,
          quests,
          inviteCodes,
          whitelist,
          currentUserId,
        })
      );
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, [players, matches, tournaments, quests, inviteCodes, whitelist, currentUserId, isHydrated]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setAuthIdentity(null);
      return;
    }

    let active = true;
    const syncAuthIdentity = async (session: Session | null) => {
      if (!session?.user?.email || !active) {
        setAuthIdentity(null);
        setCurrentUserId(null);
        return;
      }

      const email = session.user.email.trim().toLowerCase();
      const { data: profile } = await client
        .from('profiles')
        .select('role')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (active) {
        setAuthIdentity({ email, role: (profile?.role as PlayerRole) || 'player' });
      }
    };

    client.auth.getSession().then(({ data: { session } }) => {
      void syncAuthIdentity(session);
    });
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      void syncAuthIdentity(session);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const localUser = players.find((p) => p.id === currentUserId) || null;
  const authenticatedPlayer = authIdentity
    ? players.find((p) => p.email.toLowerCase() === authIdentity.email)
    : null;
  const currentUser = supabase
  ? authenticatedPlayer
    && !authenticatedPlayer.isSuspended
    ? { ...authenticatedPlayer, role: authIdentity!.role }
    : null
    : localUser;

  const refreshRemoteProfiles = async () => {
    if (!supabase) return;
    const { data: remoteProfiles, error } = await supabase.from('profiles').select('*');
    if (error || !remoteProfiles) {
      if (error) console.error('Failed to refresh profiles:', error);
      return;
    }
    setPlayers(remoteProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar || '⚽',
      email: profile.email || '',
      yearJoined: profile.year_joined,
      level: profile.level,
      xp: profile.xp,
      xpNextLevel: profile.xp_next_level,
      elo1v1: profile.elo_1v1,
      elo2v2: profile.elo_2v2,
      eloTotal: profile.elo_total,
      leaguePoints: profile.league_points,
      wins1v1: profile.wins_1v1,
      losses1v1: profile.losses_1v1,
      wins2v2: profile.wins_2v2,
      losses2v2: profile.losses_2v2,
      currentStreak: profile.current_streak,
      bestRank: profile.best_rank,
      role: profile.role as PlayerRole,
      isSuspended: profile.is_suspended ?? false,
      badges: profile.badges || [],
      eloHistory: profile.elo_history || [],
    })));
  };

  const clearLevelModal = () => setNewLevelUnlocked(null);

  const switchUser = (playerId: string) => {
    if (supabase) return;
    setCurrentUserId(playerId);
  };

  const setCurrentUser = (player: Player | null) => {
    if (!player) {
      setCurrentUserId(null);
      return;
    }
    if (supabase) {
      if (authIdentity?.email === player.email.toLowerCase()) setCurrentUserId(player.id);
      return;
    }
    setCurrentUserId(player.id);
  };

  const submitMatch = async ({
    mode,
    teamA,
    teamB,
    scoreA,
    scoreB,
  }: {
    mode: MatchMode;
    teamA: string[];
    teamB: string[];
    scoreA: number;
    scoreB: number;
  }): Promise<{ success: boolean; matchId: string; message: string }> => {
    if (!currentUser) return { success: false, matchId: '', message: 'Nicht angemeldet' };

    if (supabase) {
      const { data, error } = await supabase.rpc('submit_match_result', {
        p_mode: mode,
        p_team_a: teamA,
        p_team_b: teamB,
        p_score_a: scoreA,
        p_score_b: scoreB,
      });
      if (error || !data) {
        return {
          success: false,
          matchId: '',
          message: error?.message || 'Spiel konnte serverseitig nicht gespeichert werden.',
        };
      }
      const remoteMatch = data as {
        id: string;
        mode: MatchMode;
        creator_id: string;
        team_a: string[];
        team_b: string[];
        score_a: number;
        score_b: number;
        status: Match['status'];
        confirmed_by: string[];
        elo_change_a: number;
        elo_change_b: number;
        result_applied: boolean;
        disputed_by?: string;
        dispute_reason?: string;
        dispute_proposed_score_a?: number;
        dispute_proposed_score_b?: number;
        dispute_proposed_by?: string;
        created_at: string;
      };
      const mappedMatch: Match = {
        id: remoteMatch.id,
        mode: remoteMatch.mode,
        date: remoteMatch.created_at.slice(0, 10),
        creatorId: remoteMatch.creator_id,
        teamA: remoteMatch.team_a,
        teamB: remoteMatch.team_b,
        scoreA: remoteMatch.score_a,
        scoreB: remoteMatch.score_b,
        status: remoteMatch.status,
        confirmedBy: remoteMatch.confirmed_by,
        resultApplied: remoteMatch.result_applied,
        disputedBy: remoteMatch.disputed_by,
        disputeReason: remoteMatch.dispute_reason,
        disputeProposedScoreA: remoteMatch.dispute_proposed_score_a,
        disputeProposedScoreB: remoteMatch.dispute_proposed_score_b,
        disputeProposedBy: remoteMatch.dispute_proposed_by,
        eloChangeA: remoteMatch.elo_change_a,
        eloChangeB: remoteMatch.elo_change_b,
      };
      setMatches((prev) => [mappedMatch, ...prev]);
      await refreshRemoteProfiles();
      return {
        success: true,
        matchId: mappedMatch.id,
        message: 'Spiel wurde sicher gespeichert und serverseitig gewertet.',
      };
    }

    const newMatchId = 'm_' + Date.now();
    const newMatch: Match = {
      id: newMatchId,
      mode,
      date: new Date().toISOString().split('T')[0],
      creatorId: currentUser.id,
      teamA,
      teamB,
      scoreA,
      scoreB,
      status: 'pending',
      confirmedBy: [currentUser.id],
      resultApplied: false,
      eloChangeA: 0,
      eloChangeB: 0,
    };

    setMatches((prev) => [newMatch, ...prev]);
    confirmMatch(newMatchId, newMatch);

    return {
      success: true,
      matchId: newMatchId,
      message: 'Spiel wurde eingetragen und ist sofort wirksam. Die Gegenseite wurde benachrichtigt und kann widersprechen.',
    };
  };

  const confirmMatch = (matchId: string, matchOverride?: Match) => {
    // In the connected mode, scoring is performed atomically by
    // submit_match_result in Supabase. Never award local points for a
    // match that may not exist in the database.
    if (supabase) return;

    setMatches((prevMatches) => {
      const match = matchOverride || prevMatches.find((m) => m.id === matchId);
      if (!match || match.status === 'confirmed') return prevMatches;

      if (match.resultApplied) {
        return prevMatches.map((m) =>
          m.id === matchId ? { ...m, status: 'confirmed' } : m
        );
      }

      // Calculate Elo changes
      const teamAPlayers = players.filter((p) => match.teamA.includes(p.id));
      const teamBPlayers = players.filter((p) => match.teamB.includes(p.id));

      const avgEloA = getAverageElo(
        teamAPlayers.map((p) => (match.mode === '1v1' ? p.elo1v1 : p.elo2v2))
      );
      const avgEloB = getAverageElo(
        teamBPlayers.map((p) => (match.mode === '1v1' ? p.elo1v1 : p.elo2v2))
      );

      const { changeA, changeB, isWinA } = calculateEloChange(
        avgEloA,
        avgEloB,
        match.scoreA,
        match.scoreB
      );

      // Update players state with Elo, XP, wins, streaks, levels
      setPlayers((prevPlayers) => {
        let levelUpEvent: { player: Player; oldLevel: number; newLevel: number } | null = null;

        const updated = prevPlayers.map((player) => {
          const inTeamA = match.teamA.includes(player.id);
          const inTeamB = match.teamB.includes(player.id);

          if (!inTeamA && !inTeamB) return player;

          const isWin = inTeamA ? isWinA : !isWinA;
          const eloDelta = inTeamA ? changeA : changeB;

          // XP Calculation
          let addedXp = MATCH_XP.PLAYED;
          if (isWin) addedXp += MATCH_XP.WIN;
          const winnerScore = isWinA ? match.scoreA : match.scoreB;
          const loserScore = isWinA ? match.scoreB : match.scoreA;
          if (winnerScore >= 10 && loserScore <= 1) {
            addedXp += MATCH_XP.SHUTOUT_BONUS;
          }

          let newXp = player.xp + addedXp;
          let newLevel = player.level;
          let requiredXp = getXpForNextLevel(newLevel);

          while (newXp >= requiredXp && newLevel < 50) {
            newXp -= requiredXp;
            newLevel += 1;
            requiredXp = getXpForNextLevel(newLevel);
            if (player.id === currentUser?.id) {
              levelUpEvent = { player, oldLevel: player.level, newLevel };
            }
          }

          // New ELO
          const updatedElo1v1 =
            match.mode === '1v1' ? Math.max(100, player.elo1v1 + eloDelta) : player.elo1v1;
          const updatedElo2v2 =
            match.mode === '2v2' ? Math.max(100, player.elo2v2 + eloDelta) : player.elo2v2;
          const updatedEloTotal = Math.round((updatedElo1v1 + updatedElo2v2) / 2);

          // Streaks
          const currentStreak = isWin ? player.currentStreak + 1 : 0;

          // League Points: 3 points for win, 0 for loss
          const leaguePoints = player.leaguePoints + (isWin ? 3 : 0);

          // History
          const newHistory = [
            ...player.eloHistory,
            { date: new Date().toISOString().split('T')[0], elo: updatedEloTotal },
          ];

          return {
            ...player,
            level: newLevel,
            xp: newXp,
            xpNextLevel: requiredXp,
            elo1v1: updatedElo1v1,
            elo2v2: updatedElo2v2,
            eloTotal: updatedEloTotal,
            leaguePoints,
            wins1v1: match.mode === '1v1' && isWin ? player.wins1v1 + 1 : player.wins1v1,
            losses1v1: match.mode === '1v1' && !isWin ? player.losses1v1 + 1 : player.losses1v1,
            wins2v2: match.mode === '2v2' && isWin ? player.wins2v2 + 1 : player.wins2v2,
            losses2v2: match.mode === '2v2' && !isWin ? player.losses2v2 + 1 : player.losses2v2,
            currentStreak,
            eloHistory: newHistory,
          };

        });

        if (levelUpEvent) {
          setNewLevelUnlocked(levelUpEvent);
        }

        return updated;
      });

      return prevMatches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              status: 'confirmed',
              confirmedBy: Array.from(new Set([...m.confirmedBy, currentUser?.id || ''])),
              eloChangeA: changeA,
              eloChangeB: changeB,
              resultApplied: true,
            }
          : m
      );
    });
  };

  const acknowledgeMatch = async (matchId: string) => {
    if (!currentUser) return;
    if (supabase) {
      const { error } = await supabase.rpc('acknowledge_match', { p_match_id: matchId });
      if (error) {
        console.error('Match acknowledgement failed:', error);
        return;
      }
    }
    setMatches((prev) =>
      prev.map((match) =>
        match.id === matchId
          ? {
              ...match,
              confirmedBy: Array.from(new Set([...match.confirmedBy, currentUser.id])),
            }
          : match
      )
    );
  };

  const disputeMatch = async (
    matchId: string,
    reason: string,
    proposedScoreA?: number,
    proposedScoreB?: number
  ) => {
    if (!currentUser) return;
    if (supabase) {
      const { error } = await supabase.rpc('dispute_match', {
        p_match_id: matchId,
        p_reason: reason,
        p_score_a: proposedScoreA ?? null,
        p_score_b: proposedScoreB ?? null,
      });
      if (error) {
        console.error('Match dispute failed:', error);
        return;
      }
    }
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              status: 'disputed',
              disputedBy: currentUser.id,
              disputeReason: reason,
              disputeProposedScoreA: proposedScoreA,
              disputeProposedScoreB: proposedScoreB,
              disputeProposedBy: currentUser.id,
            }
          : m
      )
    );
  };

  const proposeDisputeResolution = async (
    matchId: string,
    proposedScoreA: number,
    proposedScoreB: number,
    reason?: string
  ) => {
    if (!currentUser) return;
    if (supabase) {
      const { data, error } = await supabase
        .from('matches')
        .update({
          dispute_proposed_score_a: proposedScoreA,
          dispute_proposed_score_b: proposedScoreB,
          dispute_proposed_by: currentUser.id,
          dispute_reason: reason || undefined,
        })
        .eq('id', matchId)
        .eq('status', 'disputed')
        .select('id')
        .single();
      if (error || !data) {
        console.error('Dispute resolution proposal failed:', error);
        return;
      }
    }
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              status: 'disputed',
              disputeProposedScoreA: proposedScoreA,
              disputeProposedScoreB: proposedScoreB,
              disputeProposedBy: currentUser.id,
              disputeReason: reason || m.disputeReason,
            }
          : m
      )
    );
  };

  const acceptDisputeResolution = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const proposedScoreA = match.disputeProposedScoreA;
    const proposedScoreB = match.disputeProposedScoreB;
    if (supabase) {
      if (proposedScoreA === undefined || proposedScoreB === undefined) return;
      const { data, error } = await supabase
        .from('matches')
        .update({
          score_a: proposedScoreA,
          score_b: proposedScoreB,
          status: 'confirmed',
          confirmed_by: Array.from(new Set([...match.confirmedBy, currentUser?.id || ''])),
        })
        .eq('id', matchId)
        .eq('status', 'disputed')
        .select('id')
        .single();
      if (error || !data) {
        console.error('Dispute resolution acceptance failed:', error);
        return;
      }
    }

    if (
      proposedScoreA !== undefined &&
      proposedScoreB !== undefined
    ) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                scoreA: proposedScoreA,
                scoreB: proposedScoreB,
                status: supabase ? 'confirmed' : m.status,
              }
            : m
        )
      );
    }

    if (!supabase) confirmMatch(matchId);
  };

  const cancelMatchByMutualAgreement = async (matchId: string) => {
    if (supabase) {
      const { error } = await supabase.rpc('cancel_match', { p_match_id: matchId });
      if (error) {
        console.error('Match cancellation failed:', error);
        return;
      }
      await refreshRemoteProfiles();
    }
    setMatches((prev) =>
      supabase
        ? prev.map((match) => match.id === matchId
          ? { ...match, status: 'cancelled', resultApplied: false, eloChangeA: 0, eloChangeB: 0 }
          : match)
        : prev.filter((match) => match.id !== matchId)
    );
  };

  const adminResolveDispute = async (
    matchId: string,
    action: 'confirm' | 'cancel',
    adjustedScoreA?: number,
    adjustedScoreB?: number
  ) => {
    if (action === 'cancel') {
      await cancelMatchByMutualAgreement(matchId);
      return;
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('matches')
        .update({
          ...(adjustedScoreA !== undefined && adjustedScoreB !== undefined
            ? { score_a: adjustedScoreA, score_b: adjustedScoreB }
            : {}),
          status: 'confirmed',
        })
        .eq('id', matchId)
        .eq('status', 'disputed')
        .select('id')
        .single();
      if (error || !data) {
        console.error('Admin match resolution failed:', error);
        return;
      }
    }

    if (adjustedScoreA !== undefined && adjustedScoreB !== undefined) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId ? { ...m, scoreA: adjustedScoreA, scoreB: adjustedScoreB } : m
        )
      );
    }

    if (supabase) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                status: 'confirmed',
                ...(adjustedScoreA !== undefined && adjustedScoreB !== undefined
                  ? { scoreA: adjustedScoreA, scoreB: adjustedScoreB }
                  : {}),
              }
            : m
        )
      );
    } else {
      confirmMatch(matchId);
    }
  };

  // =========================================================================
  // EMAIL WHITELIST & VERIFICATION FLOW
  // =========================================================================
  const checkWhitelistAndSendCode = async (rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
    }

    if (!supabase) {
      return {
        success: false,
        message: 'Die sichere Authentifizierung ist derzeit nicht konfiguriert.',
      };
    }

    const existingPlayer = players.find((p) => p.email.toLowerCase() === email);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return {
        success: false,
        message: `Supabase E-Mail-Fehler: "${error.message}". Bitte überprüfe die Supabase-Konfiguration.`,
      };
    }

    return {
      success: true,
      isExistingPlayer: Boolean(existingPlayer),
      message: `Verifikationscode angefordert. Bitte prüfe dein Postfach (auch Spam-Ordner).`,
    };
  };

  const verifyCode = async (rawEmail: string, enteredCode: string): Promise<{ success: boolean; message: string; isExistingPlayer?: boolean }> => {
    const email = rawEmail.trim().toLowerCase();
    const cleanCode = enteredCode.trim();

    if (!supabase) {
      return { success: false, message: 'Die sichere Authentifizierung ist derzeit nicht konfiguriert.' };
    }

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: cleanCode,
      type: 'email',
    });
    if (error) {
      return {
        success: false,
        message: 'Ungültiger oder abgelaufener Verifikationscode. Bitte prüfe dein Postfach.',
      };
    }

    const existingPlayer = players.find((p) => p.email.toLowerCase() === email);
    if (existingPlayer) {
      // Auto-upgrade to admin if master admin email
      setCurrentUserId(existingPlayer.id);
      return {
        success: true,
        isExistingPlayer: true,
        message: `Erfolgreich verifiziert! Willkommen zurück, ${existingPlayer.name}!`,
      };
    }

    return {
      success: true,
      isExistingPlayer: false,
      message: 'Code bestätigt! Bitte erstelle nun dein Spielerprofil.',
    };
  };

  const completeProfileCreation = async ({
    email: rawEmail,
    name,
    avatar,
    yearJoined,
  }: {
    email: string;
    name: string;
    avatar: string;
    yearJoined: number;
  }) => {
    const email = rawEmail.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      return { success: false, message: 'Bitte einen Spielernamen eingeben.' };
    }
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(yearJoined) || yearJoined < 2000 || yearJoined > currentYear) {
      return { success: false, message: 'Bitte einen gültigen Uni-Jahrgang auswählen.' };
    }

    if (!supabase) {
      return { success: false, message: 'Die sichere Authentifizierung ist derzeit nicht konfiguriert.' };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user?.id || session.user.email?.toLowerCase() !== email) {
      return { success: false, message: 'Bitte bestätige zuerst diese E-Mail-Adresse.' };
    }

    const { data: whitelisted, error: whitelistError } = await supabase.rpc(
      'is_email_whitelisted',
      { candidate_email: email }
    );
    if (whitelistError || !whitelisted) {
      return { success: false, message: 'Diese E-Mail ist nicht freigeschaltet.' };
    }

    const existing = players.find(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase() || p.email.toLowerCase() === email
    );
    if (existing) {
      return { success: false, message: 'Dieser Spielername oder diese E-Mail ist bereits vergeben.' };
    }

    const newPlayerId = session.user.id;
    const assignedRole: PlayerRole = 'player';

    const newPlayer: Player = {
      id: newPlayerId,
      name: cleanName,
      avatar: avatar || '⚽',
      email,
      yearJoined,
      level: 1,
      xp: 0,
      xpNextLevel: 100,
      elo1v1: 1000,
      elo2v2: 1000,
      eloTotal: 1000,
      leaguePoints: 0,
      wins1v1: 0,
      losses1v1: 0,
      wins2v2: 0,
      losses2v2: 0,
      currentStreak: 0,
      bestRank: players.length + 1,
      role: assignedRole,
      badges: [],
      eloHistory: [{ date: new Date().toISOString().split('T')[0], elo: 1000 }],
    };

    const { error: profileError } = await supabase.rpc('create_player_profile', {
      p_name: cleanName,
      p_avatar: avatar || '⚽',
      p_year_joined: yearJoined,
    });
    if (profileError) {
      return { success: false, message: `Profil konnte nicht erstellt werden: ${profileError.message}` };
    }

    setPlayers((prev) => [...prev, newPlayer]);
    setCurrentUserId(newPlayerId);

    return {
      success: true,
      message: 'Profil erfolgreich erstellt! Willkommen in der Liga.',
    };
  };

  const updatePlayerRole = async (playerId: string, newRole: PlayerRole) => {
    if (!currentUser || !['owner', 'co_owner'].includes(currentUser.role)) return;
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', playerId);
      if (error) return;
    }
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, role: newRole } : p))
    );
  };

  const setPlayerSuspension = async (playerId: string, suspended: boolean) => {
    if (!currentUser || !['owner', 'co_owner', 'admin'].includes(currentUser.role)) {
      return { success: false, message: 'Keine Berechtigung.' };
    }
    if (playerId === currentUser.id) {
      return { success: false, message: 'Das eigene Konto kann nicht gesperrt werden.' };
    }
    if (supabase) {
      const { error } = await supabase.rpc('set_player_suspension', {
        p_player_id: playerId,
        p_suspended: suspended,
      });
      if (error) return { success: false, message: error.message };
    }
    setPlayers((prev) =>
      prev.map((player) => player.id === playerId ? { ...player, isSuspended: suspended } : player)
    );
    return { success: true, message: suspended ? 'Spieler gesperrt.' : 'Spieler entsperrt.' };
  };

  const addWhitelistEntry = async (rawPattern: string) => {
    const pattern = rawPattern.trim().toLowerCase();
    if (!pattern) return { success: false, message: 'Muster darf nicht leer sein' };
    if (whitelist.some((w) => w.pattern.toLowerCase() === pattern)) {
      return { success: false, message: 'Bereits auf der Whitelist vorhanden' };
    }

    if (!supabase) {
      return { success: false, message: 'Die sichere Datenbankverbindung ist nicht konfiguriert.' };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData.session?.user.id;
    if (!authUserId || !['owner', 'co_owner', 'admin'].includes(currentUser?.role || '')) {
      return { success: false, message: 'Nur authentifizierte Administratoren dürfen die Whitelist ändern.' };
    }

    const { data: inserted, error } = await supabase
      .from('whitelist')
      .insert({ pattern, added_by: authUserId })
      .select('id, pattern, added_by, created_at')
      .single();
    if (error || !inserted) {
      return { success: false, message: error?.message || 'Whitelist-Eintrag konnte nicht gespeichert werden.' };
    }

    setWhitelist((prev) => [
      ...prev,
      {
        id: inserted.id,
        pattern: inserted.pattern,
        addedBy: inserted.added_by,
        createdAt: inserted.created_at.slice(0, 10),
      },
    ]);

    return { success: true, message: `"${pattern}" zur Whitelist hinzugefügt.` };
  };

  const removeWhitelistEntry = async (id: string) => {
    if (!supabase) {
      return { success: false, message: 'Die sichere Datenbankverbindung ist nicht konfiguriert.' };
    }
    const { error } = await supabase.from('whitelist').delete().eq('id', id);
    if (error) {
      return { success: false, message: error.message };
    }
    setWhitelist((prev) => prev.filter((w) => w.id !== id));
    return { success: true, message: 'Whitelist-Eintrag entfernt.' };
  };

  // Backwards-compatible legacy helpers
  const registerWithInvite = async ({
    name,
    email,
    inviteCode,
    avatar,
  }: {
    name: string;
    email: string;
    inviteCode: string;
    avatar: string;
  }) => {
    if (!inviteCode.trim()) {
      return { success: false, message: 'Ein Einladungscode ist erforderlich.' };
    }
    if (!supabase) {
      return { success: false, message: 'Die sichere Authentifizierung ist derzeit nicht konfiguriert.' };
    }
    const { data: inviteAccepted, error: inviteError } = await supabase.rpc(
      'consume_invite_code',
      { candidate_code: inviteCode }
    );
    if (inviteError || !inviteAccepted) {
      return { success: false, message: 'Der Einladungscode ist ungültig oder bereits ausgeschöpft.' };
    }
    return completeProfileCreation({ email, name, avatar, yearJoined: new Date().getFullYear() });
  };

  const loginPlayer = (nameOrEmail: string) => {
    const clean = nameOrEmail.trim().toLowerCase();
    const found = players.find(
      (p) => p.name.toLowerCase() === clean || p.email.toLowerCase() === clean
    );
    if (!found) {
      return { success: false, message: 'Kein Spieler mit diesem Namen oder dieser E-Mail gefunden.' };
    }
    setCurrentUserId(found.id);
    return { success: true, message: `Willkommen zurück, ${found.name}!` };
  };

  const logout = async () => {
    setCurrentUserId(null);
    setAuthIdentity(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const createInviteCode = (code: string, maxUses: number) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return { success: false, message: 'Code darf nicht leer sein' };
    if (inviteCodes.some((c) => c.code === clean)) {
      return { success: false, message: 'Code existiert bereits' };
    }

    setInviteCodes((prev) => [
      ...prev,
      {
        code: clean,
        createdBy: currentUser?.id || 'admin',
        createdAt: new Date().toISOString().split('T')[0],
        maxUses,
        isActive: true,
      },
    ]);

    return { success: true, message: `Code ${clean} erfolgreich erstellt!` };
  };

  const createTournament = ({
    name,
    description,
    type,
    mode,
    participants,
  }: {
    name: string;
    description: string;
    type: 'ko' | 'groups' | 'round_robin';
    mode: MatchMode;
    participants: string[];
  }) => {
    const newTourney: Tournament = {
      id: 'tourney_' + Date.now(),
      name,
      description,
      type,
      mode,
      status: 'running',
      participants,
      createdAt: new Date().toISOString().split('T')[0],
      matches: [],
    };

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const matches = [];

    if (type === 'ko') {
      const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, shuffled.length)));
      const bracketPlayers = [...shuffled, ...Array<string | undefined>(bracketSize - shuffled.length)];
      const rounds = Math.log2(bracketSize);

      for (let i = 0; i < bracketSize; i += 2) {
        matches.push({
          id: `tm_${Date.now()}_${i}`,
          round: 1,
          matchIndex: Math.floor(i / 2),
          playerAId: bracketPlayers[i],
          playerBId: bracketPlayers[i + 1],
          winnerId: bracketPlayers[i + 1] ? undefined : bracketPlayers[i],
        });
      }

      for (let round = 2; round <= rounds; round += 1) {
        const matchesInRound = bracketSize / 2 ** round;
        for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
          matches.push({
            id: `tm_${Date.now()}_r${round}_i${matchIndex}`,
            round,
            matchIndex,
            playerAId: undefined,
            playerBId: undefined,
          });
        }
      }

      for (let round = 1; round < rounds; round += 1) {
        const currentRound = matches.filter((match) => match.round === round);
        const nextRound = matches.filter((match) => match.round === round + 1);
        currentRound.forEach((match) => {
          if (!match.winnerId) return;
          const nextMatch = nextRound[Math.floor(match.matchIndex / 2)];
          if (match.matchIndex % 2 === 0) nextMatch.playerAId = match.winnerId;
          else nextMatch.playerBId = match.winnerId;
        });
        nextRound.forEach((match) => {
          if (match.playerAId && !match.playerBId) match.winnerId = match.playerAId;
          if (match.playerBId && !match.playerAId) match.winnerId = match.playerBId;
        });
      }
    } else {
      let matchIndex = 0;
      for (let i = 0; i < shuffled.length; i += 1) {
        for (let j = i + 1; j < shuffled.length; j += 1) {
          matches.push({
            id: `tm_${Date.now()}_${matchIndex}`,
            round: 1,
            matchIndex,
            playerAId: shuffled[i],
            playerBId: shuffled[j],
          });
          matchIndex += 1;
        }
      }
    }

    newTourney.matches = matches;

    setTournaments((prev) => [newTourney, ...prev]);
  };

  const advanceTournamentMatch = (
    tournamentId: string,
    matchId: string,
    scoreA: number,
    scoreB: number
  ) => {
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA === scoreB) {
      return;
    }

    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== tournamentId) return t;

        const updatedMatches = t.matches.map((m) => {
          if (m.id !== matchId) return m;
          if (!m.playerAId || !m.playerBId) return m;
          const winnerId = scoreA > scoreB ? m.playerAId : m.playerBId;
          return {
            ...m,
            scoreA,
            scoreB,
            winnerId,
          };
        });

        const currentMatch = updatedMatches.find((m) => m.id === matchId);
        if (currentMatch && currentMatch.winnerId && t.type === 'ko') {
          const winnerId = currentMatch.winnerId;
          const nextRound = currentMatch.round + 1;
          const nextIndex = Math.floor(currentMatch.matchIndex / 2);
          const isPlayerA = currentMatch.matchIndex % 2 === 0;

          let nextMatch = updatedMatches.find(
            (m) => m.round === nextRound && m.matchIndex === nextIndex
          );

          if (!nextMatch && currentMatch.round < Math.ceil(Math.log2(Math.max(2, t.participants.length)))) {
            nextMatch = {
              id: `tm_${t.id}_r${nextRound}_i${nextIndex}`,
              round: nextRound,
              matchIndex: nextIndex,
              playerAId: isPlayerA ? winnerId : undefined,
              playerBId: !isPlayerA ? winnerId : undefined,
            };
            updatedMatches.push(nextMatch);
          } else if (nextMatch) {
            if (isPlayerA) nextMatch.playerAId = winnerId;
            else nextMatch.playerBId = winnerId;
          }
        }

        const finalMatch = updatedMatches.find(
          (m) => m.round === Math.max(...updatedMatches.map((match) => match.round)) && m.playerAId && m.playerBId
        );
        const isComplete = t.type === 'ko'
          ? Boolean(finalMatch?.winnerId)
          : updatedMatches.every((m) => m.winnerId !== undefined);
        const tournamentWinner = t.type === 'ko'
          ? finalMatch?.winnerId
          : [...t.participants].sort((a, b) => {
              const score = (playerId: string) =>
                updatedMatches.reduce((total, match) => {
                  if (match.winnerId !== playerId) return total;
                  return total + 3;
                }, 0);
              return score(b) - score(a);
            })[0];

        return {
          ...t,
          matches: updatedMatches,
          status: isComplete ? 'completed' : 'running',
          winnerId: isComplete ? tournamentWinner : undefined,
        };
      })
    );
  };

  const resetToDefaultData = () => {
    setPlayers([]);
    setMatches([]);
    setTournaments([]);
    setQuests(INITIAL_WEEKLY_QUESTS);
    setInviteCodes(INITIAL_INVITE_CODES);
    setWhitelist(INITIAL_WHITELIST);
    setCurrentUserId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        players,
        matches,
        tournaments,
        quests,
        inviteCodes,
        whitelist,
        newLevelUnlocked,
        clearLevelModal,
        setCurrentUser,
        switchUser,
        submitMatch,
        confirmMatch,
        acknowledgeMatch,
        disputeMatch,
        proposeDisputeResolution,
        acceptDisputeResolution,
        cancelMatchByMutualAgreement,
        adminResolveDispute,
        registerWithInvite,
        loginPlayer,
        logout,
        updatePlayerRole,
        setPlayerSuspension,
        checkWhitelistAndSendCode,
        verifyCode,
        completeProfileCreation,
        addWhitelistEntry,
        removeWhitelistEntry,
        createInviteCode,
        createTournament,
        advanceTournamentMatch,
        resetToDefaultData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
