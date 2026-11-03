const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-typescript.cjs');
const { parseLocation, locationHash, TABS, RANKING_FILTERS } = loadTypeScript('src/lib/navigation.ts', {}, { URLSearchParams });
const { DEFAULT_MATCH_FILTERS, filterMatches } = loadTypeScript('src/lib/matchFilters.ts');
const { weeklyCrawlers } = loadTypeScript('src/lib/statistics.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('all sections and ranking filters survive static-hosting URL round trips', () => {
  for (const tab of TABS) {
    for (const ranking of RANKING_FILTERS) {
      const location = parseLocation(locationHash({ tab, ranking }));
      assert.equal(location.tab, tab);
      assert.equal(location.ranking, tab === 'ranking' ? ranking : 'elo');
    }
  }
});

test('detail URLs encode identifiers and give one detail view precedence', () => {
  const playerId = 'a&b /?#ü';
  const location = parseLocation(locationHash({ tab: 'ranking', ranking: 'krabbler', playerId }));
  assert.equal(location.playerId, playerId);
  assert.equal(location.ranking, 'krabbler');
  assert.equal(parseLocation('#tab=matches&match=game-1').matchId, 'game-1');
  assert.equal(parseLocation(locationHash({ tab: 'tournaments', ranking: 'elo', tournamentId: 'cup & 1' })).tournamentId, 'cup & 1');
  assert.equal(parseLocation('#player=a&match=b').matchId, undefined);
  assert.equal(parseLocation('#tab=unknown&ranking=unknown').tab, 'dashboard');
  assert.equal(parseLocation('#tab=unknown&ranking=unknown').ranking, 'elo');
});

const game = (id, teamA, teamB, extra = {}) => ({
  id, teamA, teamB, mode: teamA.length === 2 ? '2v2' : '1v1',
  date: '2026-11-02', scoreA: 0, scoreB: 10, status: 'confirmed',
  confirmedBy: [], creatorId: teamA[0], eloChangeA: 0, eloChangeB: 0,
  ...extra,
});

test('mine includes either side in singles and doubles and combines with mode/status', () => {
  const matches = [
    game('single-a', ['me'], ['other']),
    game('single-b', ['other'], ['me'], { status: 'disputed' }),
    game('double-a', ['partner', 'me'], ['a', 'b'], { status: 'pending', resultApplied: true }),
    game('double-b', ['a', 'b'], ['me', 'partner']),
    game('cancelled', ['me'], ['other'], { status: 'cancelled' }),
    game('unrelated', ['a'], ['b']),
  ];
  assert.equal(filterMatches(matches, DEFAULT_MATCH_FILTERS, 'me').length, 6);
  assert.equal(filterMatches(matches, { ...DEFAULT_MATCH_FILTERS, onlyMine: true }, 'me').length, 5);
  assert.deepEqual(plain(filterMatches(matches, { mode: '2v2', status: 'confirmed', onlyMine: true }, 'me').map((match) => match.id)), ['double-b']);
  assert.equal(filterMatches(matches, { ...DEFAULT_MATCH_FILTERS, onlyMine: true }).length, 0);
  assert.equal(filterMatches(matches, DEFAULT_MATCH_FILTERS, 'me', 'partner').length, 2);
  assert.equal(filterMatches(matches, { ...DEFAULT_MATCH_FILTERS, status: 'disputed' }, 'me', 'partner').length, 0);
});

test('crawler counts both losing teammates, applied disputes, and legacy confirmations without qualification', () => {
  const matches = [
    game('single', ['new'], ['winner'], { scoreB: 7 }),
    game('double', ['new', 'partner'], ['a', 'b']),
    game('opposite', ['winner'], ['partner'], { scoreA: 9, scoreB: 0, status: 'disputed', resultApplied: true }),
    game('cancelled', ['new'], ['winner'], { status: 'cancelled', resultApplied: true }),
    game('unapplied', ['new'], ['winner'], { status: 'pending', resultApplied: false }),
    game('non-zero', ['new'], ['winner'], { scoreA: 1 }),
    game('previous-week', ['new'], ['winner'], { date: '2026-11-01' }),
    game('future', ['new'], ['winner'], { date: '2026-11-04' }),
  ];
  assert.deepEqual(plain(weeklyCrawlers(matches, new Date('2026-11-03T11:00:00Z'))), [
    { playerId: 'new', losses: 2, worstScore: 10 },
    { playerId: 'partner', losses: 2, worstScore: 10 },
  ]);
});

test('crawler sorts by count, worst score, then stable identifier; week reset yields empty results', () => {
  const matches = [
    game('a', ['a'], ['winner'], { scoreB: 8 }),
    game('b', ['b'], ['winner']),
    game('c', ['c'], ['winner']),
    game('a2', ['a'], ['winner'], { scoreB: 7 }),
  ];
  assert.deepEqual(plain(weeklyCrawlers(matches, new Date('2026-11-03')).map((entry) => entry.playerId)), ['a', 'b', 'c']);
  assert.equal(weeklyCrawlers(matches, new Date('2026-11-09')).length, 0);
  assert.equal(weeklyCrawlers([], new Date('2026-11-03')).length, 0);
});
