'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Player, Match, Tournament, WeeklyQuest, InviteCode, MatchMode } from '@/types';
import { INITIAL_PLAYERS, INITIAL_MATCHES, INITIAL_TOURNAMENTS, INITIAL_INVITE_CODES } from './mockData';
import { INITIAL_WEEKLY_QUESTS } from './badges';
import { calculateEloChange, getAverageElo } from './elo';
import { getXpForNextLevel, MATCH_XP, getTierForLevel } from './levels';

interface StoreContextType {
  currentUser: Player | null;
  players: Player[];
  matches: Match[];
  tournaments: Tournament[];
  quests: WeeklyQuest[];
  inviteCodes: InviteCode[];
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
  }) => { success: boolean; matchId: string; message: string };
  confirmMatch: (matchId: string) => void;
  disputeMatch: (matchId: string, reason: string, proposedScoreA?: number, proposedScoreB?: number) => void;
  proposeDisputeResolution: (matchId: string, proposedScoreA: number, proposedScoreB: number, reason?: string) => void;
  acceptDisputeResolution: (matchId: string) => void;
  cancelMatchByMutualAgreement: (matchId: string) => void;
  adminResolveDispute: (matchId: string, action: 'confirm' | 'cancel', adjustedScoreA?: number, adjustedScoreB?: number) => void;
  registerWithInvite: (params: { name: string; email: string; inviteCode: string; avatar: string }) => { success: boolean; message: string };
  loginPlayer: (nameOrEmail: string) => { success: boolean; message: string };
  logout: () => void;
  createInviteCode: (code: string, maxUses: number) => { success: boolean; message: string };
  createTournament: (params: { name: string; description: string; type: 'ko' | 'groups' | 'round_robin'; mode: MatchMode; participants: string[] }) => void;
  advanceTournamentMatch: (tournamentId: string, matchId: string, scoreA: number, scoreB: number) => void;
  resetToDefaultData: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEY = 'bls_kicker_app_state_v2';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [tournaments, setTournaments] = useState<Tournament[]>(INITIAL_TOURNAMENTS);
  const [quests, setQuests] = useState<WeeklyQuest[]>(INITIAL_WEEKLY_QUESTS);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>(INITIAL_INVITE_CODES);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
        if (parsed.currentUserId) setCurrentUserId(parsed.currentUserId);
      }
    } catch (e) {
      console.warn('Failed to parse localStorage state:', e);
    }
    setIsHydrated(true);
  }, []);

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
          currentUserId,
        })
      );
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, [players, matches, tournaments, quests, inviteCodes, currentUserId, isHydrated]);

  const currentUser = players.find((p) => p.id === currentUserId) || null;

  const clearLevelModal = () => setNewLevelUnlocked(null);

  const switchUser = (playerId: string) => {
    setCurrentUserId(playerId);
  };

  const setCurrentUser = (player: Player | null) => {
    if (player) setCurrentUserId(player.id);
  };

  const submitMatch = ({
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
  }) => {
    if (!currentUser) return { success: false, matchId: '', message: 'Nicht angemeldet' };

    const newMatchId = 'm_' + Date.now();
    const newMatch: Match = {
      id: newMatchId,
      mode,
      date: 'Gerade eben',
      creatorId: currentUser.id,
      teamA,
      teamB,
      scoreA,
      scoreB,
      status: 'pending',
      confirmedBy: [currentUser.id],
      eloChangeA: 0,
      eloChangeB: 0,
    };

    setMatches((prev) => [newMatch, ...prev]);

    return {
      success: true,
      matchId: newMatchId,
      message: 'Spiel wurde eingetragen! Die Gegenseite muss das Ergebnis bestätigen.',
    };
  };

  const confirmMatch = (matchId: string) => {
    setMatches((prevMatches) => {
      const match = prevMatches.find((m) => m.id === matchId);
      if (!match || match.status === 'confirmed') return prevMatches;

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
            }
          : m
      );
    });
  };

  const disputeMatch = (
    matchId: string,
    reason: string,
    proposedScoreA?: number,
    proposedScoreB?: number
  ) => {
    if (!currentUser) return;
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

  const proposeDisputeResolution = (
    matchId: string,
    proposedScoreA: number,
    proposedScoreB: number,
    reason?: string
  ) => {
    if (!currentUser) return;
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

  const acceptDisputeResolution = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    if (
      match.disputeProposedScoreA !== undefined &&
      match.disputeProposedScoreB !== undefined
    ) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                scoreA: m.disputeProposedScoreA!,
                scoreB: m.disputeProposedScoreB!,
              }
            : m
        )
      );
    }

    confirmMatch(matchId);
  };

  const cancelMatchByMutualAgreement = (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  const adminResolveDispute = (
    matchId: string,
    action: 'confirm' | 'cancel',
    adjustedScoreA?: number,
    adjustedScoreB?: number
  ) => {
    if (action === 'cancel') {
      cancelMatchByMutualAgreement(matchId);
      return;
    }

    if (adjustedScoreA !== undefined && adjustedScoreB !== undefined) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId ? { ...m, scoreA: adjustedScoreA, scoreB: adjustedScoreB } : m
        )
      );
    }

    confirmMatch(matchId);
  };

  const registerWithInvite = ({
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
    const validCode = inviteCodes.find(
      (c) => c.code.trim().toUpperCase() === inviteCode.trim().toUpperCase() && c.isActive
    );

    if (!validCode) {
      return { success: false, message: 'Ungültiger oder abgelaufener Einladungscode!' };
    }

    const existing = players.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase() || p.email === email.trim()
    );
    if (existing) {
      return { success: false, message: 'Dieser Spielername oder diese E-Mail existiert bereits!' };
    }

    const newPlayerId = 'p_' + Date.now();
    const newPlayer: Player = {
      id: newPlayerId,
      name: name.trim(),
      avatar: avatar || '⚽',
      email: email.trim(),
      yearJoined: new Date().getFullYear(),
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
      role: players.length === 0 ? 'admin' : 'player',
      badges: [],
      eloHistory: [{ date: new Date().toISOString().split('T')[0], elo: 1000 }],
    };

    setPlayers((prev) => [...prev, newPlayer]);
    setCurrentUserId(newPlayerId);

    // Track invite usage
    setInviteCodes((prev) =>
      prev.map((c) =>
        c.code === validCode.code
          ? { ...c, usedBy: [...(c.usedBy || []), newPlayerId] }
          : c
      )
    );

    return { 
      success: true, 
      message: players.length === 0 
        ? 'Willkommen! Du bist als erster Spieler registriert und automatisch Administrator der Liga.' 
        : 'Willkommen in der Kicker League!' 
    };
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

  const logout = () => {
    setCurrentUserId(null);
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

    // If KO tournament, auto generate Round 1 bracket
    if (type === 'ko') {
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const matches = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        matches.push({
          id: `tm_${Date.now()}_${i}`,
          round: 1,
          matchIndex: Math.floor(i / 2),
          playerAId: shuffled[i],
          playerBId: shuffled[i + 1] || undefined,
        });
      }
      newTourney.matches = matches;
    }

    setTournaments((prev) => [newTourney, ...prev]);
  };

  const advanceTournamentMatch = (
    tournamentId: string,
    matchId: string,
    scoreA: number,
    scoreB: number
  ) => {
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== tournamentId) return t;

        const updatedMatches = t.matches.map((m) => {
          if (m.id !== matchId) return m;
          const winnerId = scoreA > scoreB ? m.playerAId : m.playerBId;
          return {
            ...m,
            scoreA,
            scoreB,
            winnerId,
          };
        });

        // Check if we need to spawn next round match for K.O.
        const currentMatch = updatedMatches.find((m) => m.id === matchId);
        if (currentMatch && t.type === 'ko') {
          const winnerId = currentMatch.winnerId;
          const nextRound = currentMatch.round + 1;
          const nextIndex = Math.floor(currentMatch.matchIndex / 2);
          const isPlayerA = currentMatch.matchIndex % 2 === 0;

          let nextMatch = updatedMatches.find(
            (m) => m.round === nextRound && m.matchIndex === nextIndex
          );

          if (!nextMatch) {
            nextMatch = {
              id: `tm_${t.id}_r${nextRound}_i${nextIndex}`,
              round: nextRound,
              matchIndex: nextIndex,
              playerAId: isPlayerA ? winnerId : undefined,
              playerBId: !isPlayerA ? winnerId : undefined,
            };
            updatedMatches.push(nextMatch);
          } else {
            if (isPlayerA) nextMatch.playerAId = winnerId;
            else nextMatch.playerBId = winnerId;
          }
        }

        return {
          ...t,
          matches: updatedMatches,
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
        newLevelUnlocked,
        clearLevelModal,
        setCurrentUser,
        switchUser,
        submitMatch,
        confirmMatch,
        disputeMatch,
        proposeDisputeResolution,
        acceptDisputeResolution,
        cancelMatchByMutualAgreement,
        adminResolveDispute,
        registerWithInvite,
        loginPlayer,
        logout,
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
