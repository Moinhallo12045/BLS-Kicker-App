import type { Match, MatchMode, Player, Tournament, TournamentMatch, TournamentTeam } from '@/types';

export function createLocalTournament(
  params: {name: string; description: string; type: Tournament['type']; mode: MatchMode; teams: TournamentTeam[]},
  players: Player[],
): Tournament {
  const size = params.mode === '1v1' ? 1 : 2;
  const participants = params.teams.flatMap((team) => team.playerIds);
  if (!['1v1', '2v2'].includes(params.mode) || !['ko', 'groups', 'round_robin'].includes(params.type)
    || !params.name.trim() || params.teams.length < 2 || params.teams.length > 64
    || (params.type === 'ko' && !Number.isInteger(Math.log2(params.teams.length)))
    || params.teams.some((team) => team.playerIds.length !== size)
    || new Set(params.teams.map((t) => t.id)).size !== params.teams.length
    || new Set(participants).size !== participants.length
    || participants.some((id) => !players.some((p) => p.id === id && !p.isSuspended))) {
    throw new Error('Bitte gültige, unterschiedliche Teams auswählen; K.-o. benötigt 2, 4, 8, 16, 32 oder 64 Teams.');
  }
  const teams = [...params.teams].map((team) => ({...team, playerIds: [...team.playerIds]}));
  for (let i = teams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [teams[i], teams[j]] = [teams[j], teams[i]];
  }
  const matches: TournamentMatch[] = [];
  if (params.type === 'ko') {
    for (let round = 1; round <= Math.log2(teams.length); round++) {
      for (let index = 0; index < teams.length / 2 ** round; index++) {
        matches.push({id: crypto.randomUUID(), round, matchIndex: index,
          teamAId: round === 1 ? teams[index * 2].id : undefined,
          teamBId: round === 1 ? teams[index * 2 + 1].id : undefined});
      }
    }
  } else {
    for (let a = 0; a < teams.length; a++) {
      for (let b = a + 1; b < teams.length; b++) {
        matches.push({id: crypto.randomUUID(), round: 1, matchIndex: matches.length, teamAId: teams[a].id, teamBId: teams[b].id});
      }
    }
  }
  return {id: crypto.randomUUID(), name: params.name.trim(), description: params.description.trim(),
    type: params.type, mode: params.mode, teams, participants, matches, status: 'running', createdAt: new Date().toISOString()};
}

function normalizedFixtures(source: Tournament): TournamentMatch[] {
  return source.matches.map((m) => ({...m, teamAId: m.teamAId || m.playerAId, teamBId: m.teamBId || m.playerBId,
    winnerTeamId: m.winnerTeamId || m.winnerId,
    matchIndex: m.matchIndex ?? source.matches.filter((fixture) => fixture.round === m.round).indexOf(m)}));
}

function invalidateLaterRounds(fixtures: TournamentMatch[], fixture: TournamentMatch, removedLeagueIds: Set<string>) {
  let round = fixture.round + 1;
  let previousIndex = fixture.matchIndex ?? 0;
  while (true) {
    const index = Math.floor(previousIndex / 2);
    const next = fixtures.find((m) => m.round === round && m.matchIndex === index);
    if (!next) break;
    if (next.leagueMatchId) removedLeagueIds.add(next.leagueMatchId);
    next.leagueMatchId = undefined; next.winnerTeamId = undefined; next.winnerId = undefined;
    next.scoreA = undefined; next.scoreB = undefined;
    if (previousIndex % 2 === 0) {next.teamAId = undefined; next.playerAId = undefined;}
    else {next.teamBId = undefined; next.playerBId = undefined;}
    previousIndex = index; round++;
  }
}

export function resetLocalTournamentMatch(tournaments: Tournament[], leagueMatches: Match[], leagueMatchId: string) {
  const source = tournaments.find((t) => t.matches.some((m) => m.leagueMatchId === leagueMatchId));
  if (!source) throw new Error('Der Turnierspiel-Verweis fehlt. Bitte die Turnierdaten prüfen.');
  const fixtures = normalizedFixtures(source);
  const fixture = fixtures.find((m) => m.leagueMatchId === leagueMatchId)!;
  const removedLeagueIds = new Set([leagueMatchId]);
  if (source.type === 'ko') invalidateLaterRounds(fixtures, fixture, removedLeagueIds);
  fixture.leagueMatchId = undefined; fixture.winnerTeamId = undefined; fixture.winnerId = undefined;
  fixture.scoreA = undefined; fixture.scoreB = undefined;
  return {
    tournaments: tournaments.map((t) => t.id === source.id
      ? {...t, matches: fixtures, status: 'running' as const, winnerTeamId: undefined, winnerId: undefined} : t),
    matches: leagueMatches.map((m) => removedLeagueIds.has(m.id)
      ? {...m, status: 'cancelled' as const, resultApplied: false} : m),
  };
}

export function scoreLocalTournament(tournaments: Tournament[], leagueMatches: Match[], tournamentId: string,
  fixtureId: string, scoreA: number, scoreB: number, creatorId: string) {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA === scoreB) {
    throw new Error('Bitte unterschiedliche, nicht negative ganze Torzahlen eingeben.');
  }
  const source = tournaments.find((t) => t.id === tournamentId);
  if (!source) throw new Error('Turnier nicht gefunden.');
  if (!['1v1', '2v2'].includes(source.mode) || !['ko', 'groups', 'round_robin'].includes(source.type)) throw new Error('Ungültiger Turniermodus.');
  const fixtures = normalizedFixtures(source);
  const fixture = fixtures.find((m) => m.id === fixtureId);
  if (!fixture) throw new Error('Turnierspiel nicht gefunden.');
  if (source.mode === '2v2' && !source.teams?.length) throw new Error('Dieses alte Doppelturnier hat keine festen Paare. Bitte ein neues Turnier erstellen.');
  const teams = source.teams?.length ? source.teams : source.participants.map((id) => ({id, playerIds: [id]}));
  const teamA = teams.find((t) => t.id === (fixture.teamAId || fixture.playerAId));
  const teamB = teams.find((t) => t.id === (fixture.teamBId || fixture.playerBId));
  if (!teamA || !teamB) throw new Error('Beide Teams müssen feststehen.');
  const size = source.mode === '1v1' ? 1 : 2;
  if (teamA.playerIds.length !== size || teamB.playerIds.length !== size
    || new Set([...teamA.playerIds, ...teamB.playerIds]).size !== size * 2) throw new Error('Ungültige Turnierbesetzung.');
  if (fixture.scoreA === scoreA && fixture.scoreB === scoreB && fixture.winnerTeamId) return {matches: leagueMatches, tournaments};
  const removedLeagueIds = new Set<string>();
  if (source.type === 'ko') invalidateLaterRounds(fixtures, fixture, removedLeagueIds);
  if (fixture.leagueMatchId) removedLeagueIds.add(fixture.leagueMatchId);
  const createdAt = new Date().toISOString();
  const game: Match = {id: crypto.randomUUID(), mode: source.mode, date: createdAt.slice(0, 10), createdAt,
    creatorId, teamA: teamA.playerIds, teamB: teamB.playerIds, scoreA, scoreB, status: 'confirmed',
    confirmedBy: [creatorId], resultApplied: true, eloChangeA: 0, eloChangeB: 0, tournamentId};
  fixture.teamAId = teamA.id; fixture.teamBId = teamB.id; fixture.scoreA = scoreA; fixture.scoreB = scoreB;
  fixture.winnerTeamId = scoreA > scoreB ? teamA.id : teamB.id; fixture.leagueMatchId = game.id;
  fixture.winnerId = source.mode === '1v1' ? (scoreA > scoreB ? teamA : teamB).playerIds[0] : undefined;
  if (source.type === 'ko') {
    const next = fixtures.find((m) => m.round === fixture.round + 1 && m.matchIndex === Math.floor((fixture.matchIndex ?? 0) / 2));
    if (next) {
      if ((fixture.matchIndex ?? 0) % 2 === 0) {
        next.teamAId = fixture.winnerTeamId;
        next.playerAId = fixture.winnerId;
      } else {
        next.teamBId = fixture.winnerTeamId;
        next.playerBId = fixture.winnerId;
      }
    }
  }
  const complete = fixtures.every((m) => m.winnerTeamId || m.winnerId);
  let winnerTeamId: string | undefined;
  if (complete) {
    if (source.type === 'ko') winnerTeamId = fixtures.find((m) => m.round === Math.log2(teams.length))?.winnerTeamId ?? undefined;
    else {
      const points = (id: string) => fixtures.filter((m) => m.winnerTeamId === id).length * 3;
      const goalDifference = (id: string) => fixtures.reduce((sum, m) =>
        sum + (m.teamAId === id ? (m.scoreA || 0) - (m.scoreB || 0) : m.teamBId === id ? (m.scoreB || 0) - (m.scoreA || 0) : 0), 0);
      winnerTeamId = [...teams].sort((a, b) => points(b.id) - points(a.id)
        || goalDifference(b.id) - goalDifference(a.id) || a.id.localeCompare(b.id))[0].id;
    }
  }
  const nextTournament = {...source, teams, matches: fixtures, status: complete ? 'completed' as const : 'running' as const,
    winnerTeamId, winnerId: source.mode === '1v1' ? teams.find((t) => t.id === winnerTeamId)?.playerIds[0] : undefined};
  return {
    tournaments: tournaments.map((t) => t.id === source.id ? nextTournament : t),
    matches: [game, ...leagueMatches.filter((m) => m.id !== game.id).map((m) => removedLeagueIds.has(m.id)
      ? {...m, status: 'cancelled' as const, resultApplied: false} : m)],
  };
}
