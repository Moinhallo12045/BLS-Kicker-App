import type { Match, Player, Tournament, WeeklyQuest } from '@/types';
import { calculateEloChange, getAverageElo } from './elo';
import { getXpForNextLevel, MATCH_XP } from './levels';
import { getWeekStartKey, toDateKey } from './dates';

export function weeklyCrawlers(matches: Match[], now = new Date()) {
  const start = getWeekStartKey(now);
  const end = toDateKey(now);
  const entries = new Map<string, { losses: number; worstScore: number }>();
  for (const match of matches) {
    if (!isScoredMatch(match) || match.date < start || match.date > end) continue;
    const losers = match.scoreA === 0 && match.scoreB > 0 ? match.teamA
      : match.scoreB === 0 && match.scoreA > 0 ? match.teamB : [];
    for (const id of losers) {
      const previous = entries.get(id) || { losses: 0, worstScore: 0 };
      entries.set(id, { losses: previous.losses + 1, worstScore: Math.max(previous.worstScore, match.scoreA, match.scoreB) });
    }
  }
  return Array.from(entries, ([playerId, stats]) => ({ playerId, ...stats }))
    .sort((a, b) => b.losses - a.losses || b.worstScore - a.worstScore || a.playerId.localeCompare(b.playerId));
}

const MATCH_BADGES = new Set([
  'stammgast_1', 'siegertyp_1', 'revanche', 'eingespielt_1',
  'streak_master', 'clean_sheet', 'legend_1500', 'turnier_champ',
  'stammgast_2', 'stammgast_3', 'eingespielt_2', 'eingespielt_3',
  'streak_master_2', 'streak_master_3', 'allrounder_1', 'knapper_sieg',
]);

export function isScoredMatch(match: Match): boolean {
  return match.status !== 'cancelled' && (match.resultApplied ?? match.status === 'confirmed');
}

export function qualifiedPlayers(players: Player[]): Player[] {
  return players.filter((p) => p.wins1v1 + p.losses1v1 + p.wins2v2 + p.losses2v2 >= 3)
    .sort((a, b) => b.eloTotal - a.eloTotal
      || (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
}

export function rebuildLocalStatistics(players: Player[], matches: Match[], tournaments: Tournament[]) {
  const rebuilt = players.map((p) => ({
    ...p, elo1v1: 1000, elo2v2: 1000, eloTotal: 1000, leaguePoints: 0,
    wins1v1: 0, losses1v1: 0, wins2v2: 0, losses2v2: 0,
    xp: 0, level: 1, xpNextLevel: 150, currentStreak: 0, bestRank: 999,
    eloHistory: [] as Player['eloHistory'],
    badges: p.badges.filter((badge) => !MATCH_BADGES.has(badge)),
  }));
  const byId = new Map(rebuilt.map((p) => [p.id, p]));
  const lostAgainst = new Map<string, Set<string>>();
  const partnerWins = new Map<string, number>();
  const deltas = new Map<string, { a: number; b: number }>();
  const scored = matches.filter(isScoredMatch).sort((a, b) =>
    (a.createdAt || a.date).localeCompare(b.createdAt || b.date) || a.id.localeCompare(b.id));

  for (const match of scored) {
    const teamA = match.teamA.map((id) => byId.get(id));
    const teamB = match.teamB.map((id) => byId.get(id));
    const expectedSize = match.mode === '1v1' ? 1 : 2;
    if (!['1v1', '2v2'].includes(match.mode) || teamA.length !== expectedSize || teamB.length !== expectedSize
      || new Set([...match.teamA, ...match.teamB]).size !== expectedSize * 2
      || teamA.some((p) => !p) || teamB.some((p) => !p)
      || !Number.isInteger(match.scoreA) || !Number.isInteger(match.scoreB)
      || match.scoreA < 0 || match.scoreB < 0 || match.scoreA === match.scoreB) {
      throw new Error(`Ungültiges gewertetes Spiel: ${match.id}`);
    }
    const modeElo = (p: Player) => match.mode === '1v1' ? p.elo1v1 : p.elo2v2;
    const rating = (team: (Player | undefined)[]) => getAverageElo(team.map((p) => {
      if (!p) throw new Error('Spielerprofil fehlt.');
      return modeElo(p);
    }));
    const { changeA, changeB } = calculateEloChange(rating(teamA), rating(teamB), match.scoreA, match.scoreB);
    deltas.set(match.id, { a: changeA, b: changeB });
    for (const id of [...match.teamA, ...match.teamB]) {
      const p = byId.get(id);
      if (!p) throw new Error(`Spielerprofil fehlt: ${id}`);
      const inA = match.teamA.includes(id);
      const won = inA ? match.scoreA > match.scoreB : match.scoreB > match.scoreA;
      const opponents = inA ? match.teamB : match.teamA;
      const teammates = inA ? match.teamA : match.teamB;
      const delta = inA ? changeA : changeB;
      if (match.mode === '1v1') {
        p.elo1v1 = Math.max(100, p.elo1v1 + delta);
        if (won) p.wins1v1++; else p.losses1v1++;
      } else {
        p.elo2v2 = Math.max(100, p.elo2v2 + delta);
        if (won) p.wins2v2++; else p.losses2v2++;
      }
      p.eloTotal = Math.round((p.elo1v1 + p.elo2v2) / 2);
      p.leaguePoints += won ? 3 : 0;
      p.currentStreak = won ? p.currentStreak + 1 : 0;
      p.xp += MATCH_XP.PLAYED + (won ? MATCH_XP.WIN : 0);
      while (p.level < 50 && p.xp >= p.xpNextLevel) {
        p.xp -= p.xpNextLevel;
        p.level++;
        p.xpNextLevel = getXpForNextLevel(p.level);
      }
      p.eloHistory.push({ date: match.date, elo: p.eloTotal });
      const badges = new Set(p.badges);
      const played = p.wins1v1 + p.losses1v1 + p.wins2v2 + p.losses2v2;
      if (played >= 10) badges.add('stammgast_1');
      if (played >= 25) badges.add('stammgast_2');
      if (played >= 50) badges.add('stammgast_3');
      if (p.wins1v1 + p.wins2v2 >= 5) badges.add('siegertyp_1');
      if (p.currentStreak >= 5) badges.add('streak_master');
      if (p.currentStreak >= 10) badges.add('streak_master_2');
      if (p.currentStreak >= 15) badges.add('streak_master_3');
      if (p.wins1v1 >= 5 && p.wins2v2 >= 5) badges.add('allrounder_1');
      if (won && Math.abs(match.scoreA - match.scoreB) === 1) badges.add('knapper_sieg');
      if (Math.max(p.elo1v1, p.elo2v2) > 1500) badges.add('legend_1500');
      if (won && Math.max(match.scoreA, match.scoreB) === 10 && Math.min(match.scoreA, match.scoreB) <= 1) badges.add('clean_sheet');
      if (won && opponents.some((opponent) => lostAgainst.get(id)?.has(opponent))) badges.add('revanche');
      if (!won) {
        const losses = lostAgainst.get(id) || new Set<string>();
        opponents.forEach((opponent) => losses.add(opponent));
        lostAgainst.set(id, losses);
      }
      if (won && match.mode === '2v2') {
        const key = [...teammates].sort().join(':');
        const count = partnerWins.get(`${id}:${key}`) || 0;
        partnerWins.set(`${id}:${key}`, count + 1);
        if (count + 1 >= 3) badges.add('eingespielt_1');
        if (count + 1 >= 10) badges.add('eingespielt_2');
        if (count + 1 >= 25) badges.add('eingespielt_3');
      }
      p.badges = [...badges].sort();
    }
    qualifiedPlayers(rebuilt).forEach((p, i) => { p.bestRank = Math.min(p.bestRank, i + 1); });
  }
  for (const tournament of tournaments.filter((t) => t.status === 'completed')) {
    const winners = tournament.teams?.find((team) => team.id === tournament.winnerTeamId)?.playerIds
      || (tournament.winnerId ? [tournament.winnerId] : []);
    winners.forEach((id) => {
      const p = byId.get(id);
      if (p && !p.badges.includes('turnier_champ')) p.badges.push('turnier_champ');
    });
  }
  return {
    players: rebuilt,
    matches: matches.map((match) => {
      const delta = deltas.get(match.id);
      return { ...match, eloChangeA: delta?.a || 0, eloChangeB: delta?.b || 0 };
    }),
  };
}

export function weeklyQuests(matches: Match[], playerId?: string, now = new Date()): WeeklyQuest[] {
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const games = matches.filter((m) => playerId && isScoredMatch(m)
    && [...m.teamA, ...m.teamB].includes(playerId)
    && m.date >= toDateKey(weekStart) && m.date <= toDateKey(now))
    .sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date) || a.id.localeCompare(b.id));
  const opponents = new Set<string>();
  let streak = 0;
  let best = 0;
  for (const game of games) {
    const inA = game.teamA.includes(playerId || '');
    (inA ? game.teamB : game.teamA).forEach((id) => opponents.add(id));
    streak = (inA ? game.scoreA > game.scoreB : game.scoreB > game.scoreA) ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const quests = [
    { id: 'q1', title: 'Spiel gegen 3 verschiedene Gegner', rewardXp: 0, progress: Math.min(3, opponents.size), total: 3, completed: opponents.size >= 3 },
    { id: 'q2', title: 'Spiel 5 Partien', rewardXp: 0, progress: Math.min(5, games.length), total: 5, completed: games.length >= 5 },
    { id: 'q3', title: 'Gewinne 3 Spiele in Folge', rewardXp: 0, progress: Math.min(3, best), total: 3, completed: best >= 3 },
  ];
  return quests;
}
