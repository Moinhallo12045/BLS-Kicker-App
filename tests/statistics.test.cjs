const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTypeScript, player} = require('./load-typescript.cjs');
const {rebuildLocalStatistics, qualifiedPlayers, weeklyQuests} = loadTypeScript('src/lib/statistics.ts');
const {createLocalTournament, resetLocalTournamentMatch, scoreLocalTournament} = loadTypeScript('src/lib/tournaments.ts');

function game(id, teamA, teamB, scoreA = 10, scoreB = 5) {
  return {id, teamA, teamB, mode: teamA.length === 1 ? '1v1' : '2v2',
    date: '2026-11-02', createdAt: `2026-11-02T12:00:${id.padStart(2, '0')}Z`,
    scoreA, scoreB, status: 'confirmed', confirmedBy: [], resultApplied: true,
    creatorId: teamA[0], eloChangeA: 0, eloChangeB: 0};
}
test('canonical replay rounds total ELO correctly and removes every stale statistic', () => {
  const players = ['a','b','c'].map((id) => player(id));
  const matches = [game('01',['a'],['b']), game('02',['a'],['c'])];
  const replay = rebuildLocalStatistics(players, matches, []);
  assert.equal(replay.players[0].elo1v1, 1031);
  assert.equal(replay.players[0].eloTotal, 1016);
  assert.equal(replay.players[0].level, 2);
  assert.equal(replay.players[0].xp, 0);
  const deleted = rebuildLocalStatistics(replay.players, [], []);
  assert.equal(deleted.players[0].eloTotal, 1000);
  assert.equal(deleted.players[0].wins1v1, 0);
  assert.equal(deleted.players[0].xp, 0);
  assert.equal(deleted.players[0].eloHistory.length, 0);
});
test('cancelled games do not count; disputes remain scored until removed', () => {
  const matches = [game('01',['a'],['b']), {...game('02',['a'],['b']), status:'disputed'},
    {...game('03',['a'],['b']), status:'cancelled', resultApplied:false}];
  assert.equal(rebuildLocalStatistics(['a','b'].map((id) => player(id)), matches, []).players[0].wins1v1, 2);
  const quests = weeklyQuests(matches, 'a', new Date('2026-11-04'));
  assert.equal(quests[1].progress, 2);
  assert.equal(quests[1].rewardXp, 0);
});
test('badges revoke when prerequisite games are removed', () => {
  const players = ['a','b'].map((id) => player(id));
  const loss = game('01',['a'],['b'],0,10);
  const win = game('02',['a'],['b'],10,0);
  const rebuilt = rebuildLocalStatistics(players,[loss,win],[]);
  assert.ok(rebuilt.players[0].badges.includes('revanche'));
  const remaining = rebuildLocalStatistics(rebuilt.players,[win],[]);
  assert.ok(!remaining.players[0].badges.includes('revanche'));
  assert.ok(remaining.players[0].badges.includes('clean_sheet'));
});
test('qualified ranking uses server tie ordering regardless of input order', () => {
  const older={...player('z'),createdAt:'2026-01-01T00:00:00Z',wins1v1:3};
  const newer={...player('a'),createdAt:'2026-02-01T00:00:00Z',wins1v1:3};
  assert.deepEqual(qualifiedPlayers([newer,older]).map((p)=>p.id),['z','a']);
  assert.equal(qualifiedPlayers([player('unqualified')]).length,0);
});
test('doubles knockout persists both members and invalidates downstream winners after correction', () => {
  const players = ['a','b','c','d','e','f','g','h'].map((id) => player(id));
  const teams = [0,2,4,6].map((i) => ({id:`team-${i}`,playerIds:players.slice(i,i+2).map((p)=>p.id)}));
  let tournaments = [createLocalTournament({name:'Doubles',description:'',type:'ko',mode:'2v2',teams},players)];
  let matches = [];
  const score = (id,a,b) => {
    const state=scoreLocalTournament(tournaments,matches,tournaments[0].id,id,a,b,'a');
    tournaments=state.tournaments;matches=state.matches;
  };
  const [first, second] = tournaments[0].matches.filter((m)=>m.round===1);
  score(first.id,10,0);score(second.id,10,5);
  score(tournaments[0].matches.find((m)=>m.round===2).id,10,5);
  assert.equal(tournaments[0].status,'completed');
  const replay=rebuildLocalStatistics(players,matches,tournaments);
  const winningPair=tournaments[0].teams.find((t)=>t.id===tournaments[0].winnerTeamId);
  for(const id of winningPair.playerIds) assert.ok(replay.players.find((p)=>p.id===id).badges.includes('turnier_champ'));
  const firstGame=matches.find((m)=>m.id===tournaments[0].matches.find((m)=>m.id===first.id).leagueMatchId);
  score(first.id,0,10);
  assert.notEqual(tournaments[0].matches.find((m)=>m.id===first.id).leagueMatchId,firstGame.id);
  assert.equal(matches.find((m)=>m.id===firstGame.id).status,'cancelled');
  assert.equal(matches.find((m)=>m.id===firstGame.id).createdAt,firstGame.createdAt);
  assert.equal(tournaments[0].status,'running');
  assert.equal(tournaments[0].winnerTeamId,undefined);
  assert.equal(tournaments[0].matches.find((m)=>m.round===2).scoreA,undefined);
  assert.equal(matches.filter((m)=>m.status==='confirmed').length,2);
  assert.ok(matches.every((m)=>m.teamA.length===2&&m.teamB.length===2));
});
test('admin tournament reset clears dependent rounds, league scores and both champions', () => {
  const players=['a','b','c','d','e','f','g','h'].map((id)=>player(id));
  const teams=[0,2,4,6].map((i)=>({id:`team-${i}`,playerIds:players.slice(i,i+2).map((p)=>p.id)}));
  let tournaments=[createLocalTournament({name:'Reset',description:'',type:'ko',mode:'2v2',teams},players)],matches=[];
  for (const fixture of tournaments[0].matches) {
    const state=scoreLocalTournament(tournaments,matches,tournaments[0].id,fixture.id,10,5,'a');
    tournaments=state.tournaments;matches=state.matches;
  }
  assert.equal(tournaments[0].status,'completed');
  const link=tournaments[0].matches[0].leagueMatchId;
  const reset=resetLocalTournamentMatch(tournaments,matches,link);
  assert.equal(reset.tournaments[0].status,'running');
  assert.equal(reset.tournaments[0].winnerTeamId,undefined);
  assert.equal(reset.tournaments[0].matches.find((m)=>m.round===2).teamAId,undefined);
  assert.equal(reset.matches.filter((m)=>m.resultApplied).length,1);
  assert.ok(rebuildLocalStatistics(players,reset.matches,reset.tournaments).players.every((p)=>!p.badges.includes('turnier_champ')));
});
test('invalid and duplicate teams fail explicitly; round robin creates every pair', () => {
  const players=['a','b','c','d','e','f'].map((id)=>player(id));
  const teams=[{id:'a',playerIds:['a','b']},{id:'b',playerIds:['c','d']},{id:'c',playerIds:['e','f']}];
  assert.throws(()=>createLocalTournament({name:'Bad',type:'ko',description:'',mode:'2v2',teams},players));
  const t=createLocalTournament({name:'League',type:'round_robin',description:'',mode:'2v2',teams},players);
  assert.equal(t.matches.length,3);
  assert.throws(()=>createLocalTournament({name:'Bad',type:'round_robin',description:'',mode:'2v2',
    teams:[teams[0],{id:'b',playerIds:['a','c']}]},players));
});
test('legacy doubles without saved pairs cannot create singleton league games', () => {
  const legacy = {id:'legacy',name:'Old',mode:'2v2',type:'ko',status:'running',
    participants:['a','b'],matches:[{id:'final',round:1,playerAId:'a',playerBId:'b'}]};
  assert.throws(()=>scoreLocalTournament([legacy],[],'legacy','final',10,5,'a'),/festen Paare/);
});
