'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { MatchMode, Tournament, TournamentMatch, TournamentTeam, TournamentType } from '@/types';
import { Crown, Plus, Trophy, X } from 'lucide-react';

const fieldClass = 'min-h-[44px] w-full min-w-0 rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-amber-400';
const buttonClass = 'min-h-[44px] rounded-xl px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50';
const knockoutSizes = [2, 4, 8, 16, 32, 64];

function tournamentTeams(tournament: Tournament): TournamentTeam[] {
  return tournament.teams?.length
    ? tournament.teams
    : tournament.mode === '1v1'
      ? tournament.participants.map((id) => ({ id, playerIds: [id] }))
      : [];
}

function sideId(match: TournamentMatch, side: 'A' | 'B'): string | undefined {
  return (side === 'A' ? match.teamAId ?? match.playerAId : match.teamBId ?? match.playerBId) ?? undefined;
}

function winningTeamId(match: TournamentMatch, teams: TournamentTeam[]): string | undefined {
  if (match.winnerTeamId) return match.winnerTeamId;
  if (!match.winnerId) return undefined;
  return teams.find((team) => team.id === match.winnerId)?.id
    ?? teams.find((team) => team.playerIds.includes(match.winnerId ?? ''))?.id;
}

function roundTitle(round: number, lastRound: number, knockout: boolean): string {
  if (!knockout) return `Spieltag ${round}`;
  const remaining = lastRound - round;
  if (remaining === 0) return 'Finale';
  if (remaining === 1) return 'Halbfinale';
  if (remaining === 2) return 'Viertelfinale';
  if (remaining === 3) return 'Achtelfinale';
  return `Runde der ${2 ** (remaining + 1)}`;
}

function Modal({ title, busy, onClose, children }: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeState = useRef({ busy, onClose });
  closeState.current = { busy, onClose };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('input, button, select')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeState.current.busy) {
        event.preventDefault();
        closeState.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const elements = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      );
      if (!elements?.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!Array.from(elements).some((element) => element === document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 !m-0 flex min-h-0 items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title}
        className="felt-card min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="min-w-0 text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Dialog schließen"
            className={`${buttonClass} shrink-0 text-stone-300`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TournamentView() {
  const { tournaments, players, currentUser, createTournament, advanceTournamentMatch, isLoading, syncError } = useStore();
  const [selectedId, setSelectedId] = useState('');
  const [selectedRound, setSelectedRound] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TournamentType>('ko');
  const [mode, setMode] = useState<MatchMode>('1v1');
  const [draftTeams, setDraftTeams] = useState<TournamentTeam[]>([]);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [scoring, setScoring] = useState<{ tournamentId: string; matchId: string } | null>(null);
  const [scoreA, setScoreA] = useState('10');
  const [scoreB, setScoreB] = useState('7');
  const [scoreError, setScoreError] = useState('');
  const [saving, setSaving] = useState(false);
  const [correctionConfirmed, setCorrectionConfirmed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const createLock = useRef(false);
  const scoreLock = useRef(false);
  const canManage = ['owner', 'co_owner', 'admin', 'organiser'].includes(currentUser?.role ?? '');
  const eligiblePlayers = players.filter((player) => !player.isSuspended);
  const teamSize = mode === '2v2' ? 2 : 1;
  const current = tournaments.find((tournament) => tournament.id === selectedId) ?? tournaments[0];
  const teams = current ? tournamentTeams(current) : [];
  const rounds = current ? Array.from(new Set(current.matches.map((match) => match.round))).sort((a, b) => a - b) : [];
  const activeRound = rounds.includes(selectedRound) ? selectedRound : rounds[0];
  const lastRound = rounds[rounds.length - 1] ?? 1;
  const scoringTournament = tournaments.find((tournament) => tournament.id === scoring?.tournamentId);
  const scoringMatch = scoringTournament?.matches.find((match) => match.id === scoring?.matchId);
  const scoringTeams = scoringTournament ? tournamentTeams(scoringTournament) : [];
  const isCorrection = !!(scoringMatch && winningTeamId(scoringMatch, scoringTeams));

  const teamName = (team: TournamentTeam | undefined) => team
    ? team.playerIds.map((id) => players.find((player) => player.id === id)?.name ?? 'Unbekannter Spieler').join(' + ')
    : 'Noch offen';
  const fixtureTeam = (match: TournamentMatch, side: 'A' | 'B', list: TournamentTeam[]) =>
    list.find((team) => team.id === sideId(match, side));

  const standings = teams.map((team) => {
    const completed = current?.matches.filter((match) =>
      (sideId(match, 'A') === team.id || sideId(match, 'B') === team.id) && winningTeamId(match, teams)
    ) ?? [];
    const wins = completed.filter((match) => winningTeamId(match, teams) === team.id).length;
    const scored = completed.reduce((sum, match) => sum + (sideId(match, 'A') === team.id ? match.scoreA ?? 0 : match.scoreB ?? 0), 0);
    const conceded = completed.reduce((sum, match) => sum + (sideId(match, 'A') === team.id ? match.scoreB ?? 0 : match.scoreA ?? 0), 0);
    return { team, games: completed.length, wins, scored, conceded, points: wins * 3 };
  }).sort((a, b) => b.points - a.points || (b.scored - b.conceded) - (a.scored - a.conceded) || b.scored - a.scored);

  const updateTeamPlayer = (teamId: string, slot: number, playerId: string) => {
    setDraftTeams((previous) => previous.map((team) => {
      if (team.id !== teamId) return team;
      const playerIds = [...team.playerIds];
      playerIds[slot] = playerId;
      return { ...team, playerIds };
    }));
    setCreateError('');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createLock.current) return;
    setCreateError('');
    const participantIds = draftTeams.flatMap((team) => team.playerIds);
    if (!canManage) {
      setCreateError('Nur die Turnierleitung darf Turniere anlegen.');
      return;
    }
    if (!name.trim() || draftTeams.some((team) => team.playerIds.length !== teamSize || team.playerIds.some((id) => !eligiblePlayers.some((player) => player.id === id)))) {
      setCreateError('Bitte einen Namen und alle Teammitglieder auswählen.');
      return;
    }
    if (new Set(participantIds).size !== participantIds.length) {
      setCreateError('Jeder Spieler darf nur in einem Team antreten.');
      return;
    }
    if (type === 'ko' ? !knockoutSizes.includes(draftTeams.length) : draftTeams.length < 2) {
      setCreateError(type === 'ko' ? 'K.-o.: Bitte 2, 4, 8, 16, 32 oder 64 Teams anlegen.' : 'Mindestens zwei Teams erforderlich.');
      return;
    }
    createLock.current = true;
    setCreating(true);
    try {
      const result = await createTournament({ name: name.trim(), description: description.trim(), type, mode, teams: draftTeams });
      if (!result.success) {
        setCreateError(result.message);
        return;
      }
      if (result.tournamentId) setSelectedId(result.tournamentId);
      setSelectedRound(0);
      setFeedback(result.message || 'Turnier gespeichert.');
      setShowCreate(false);
      setName('');
      setDescription('');
      setDraftTeams([]);
    } catch {
      setCreateError('Turnier konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  };

  const handleScore = async (event: React.FormEvent) => {
    event.preventDefault();
    if (scoreLock.current || !scoringTournament || !scoringMatch) return;
    setScoreError('');
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!canManage || !fixtureTeam(scoringMatch, 'A', scoringTeams) || !fixtureTeam(scoringMatch, 'B', scoringTeams)) {
      setScoreError('Dieses Spiel kann derzeit nicht gewertet werden.');
      return;
    }
    if (!/^\d+$/.test(scoreA) || !/^\d+$/.test(scoreB) || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 10 || b > 10 || a === b) {
      setScoreError('Bitte unterschiedliche ganze Torzahlen zwischen 0 und 10 eingeben.');
      return;
    }
    if (isCorrection && !correctionConfirmed) {
      setScoreError('Bitte die Auswirkungen der Korrektur bestätigen.');
      return;
    }
    scoreLock.current = true;
    setSaving(true);
    try {
      const result = await advanceTournamentMatch(scoringTournament.id, scoringMatch.id, a, b);
      if (!result.success) {
        setScoreError(result.message);
        return;
      }
      setFeedback(result.message || 'Ergebnis gespeichert.');
      setScoring(null);
    } catch {
      setScoreError('Ergebnis konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      scoreLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-5 pb-24">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white"><Crown className="h-6 w-6 text-amber-400" aria-hidden="true" />Turniere</h2>
          <p className="text-sm text-emerald-300">Einzel und Doppel mit festen Paaren</p>
        </div>
        {canManage && <button type="button" onClick={() => { setCreateError(''); setShowCreate(true); }}
          className={`${buttonClass} flex items-center justify-center gap-2 bg-amber-400 text-stone-950`}>
          <Plus className="h-4 w-4" aria-hidden="true" />Neues Turnier
        </button>}
      </header>
      {feedback && <p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{feedback}</p>}
      {syncError && <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{syncError}</p>}
      {!current && isLoading ? (
        <p role="status" className="felt-card p-5 text-sm text-emerald-200">Turniere werden geladen…</p>
      ) : !current ? (
        <div className="felt-card p-5 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-amber-400" aria-hidden="true" />
          <h3 className="font-bold text-white">Noch keine Turniere</h3>
          <p className="mt-2 text-sm text-emerald-300">{canManage ? 'Lege ein Einzel- oder Doppelturnier an.' : 'Die Turnierleitung kann ein Turnier anlegen.'}</p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="tournament-selection" className="mb-1 block text-sm text-emerald-300">Turnier auswählen</label>
            <select id="tournament-selection" value={current.id} onChange={(event) => { setSelectedId(event.target.value); setSelectedRound(0); }} className={fieldClass}>
              {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.mode}</option>)}
            </select>
          </div>
          <section className="felt-card min-w-0 space-y-5 p-3 sm:p-5" aria-label={current.name}>
            <div className="space-y-2">
              <h3 className="break-words text-xl font-bold text-white">{current.name}</h3>
              <p className="break-words text-sm text-emerald-300">{current.description}</p>
              <div className="flex flex-wrap gap-2 text-xs text-amber-200">
                <span>{current.mode === '2v2' ? '2v2 · Feste Paare' : '1v1 · Einzel'}</span>
                <span>• {teams.length} Teams</span>
                <span>• {current.type === 'ko' ? 'K.-o.' : current.type === 'groups' ? 'Gruppen · Jeder gegen jeden' : 'Jeder gegen jeden'}</span>
                <span>• {current.status === 'completed' ? 'Beendet' : current.status === 'running' ? 'Läuft' : 'Geplant'}</span>
              </div>
              {current.mode === '2v2' && teams.length === 0 && (
                <p className="text-sm text-amber-200">Für dieses ältere Doppelturnier sind keine festen Paare gespeichert. Ergebnisse können ohne gespeicherte Teams nicht eingetragen werden.</p>
              )}
              {current.status === 'completed' && (current.winnerTeamId || current.winnerId) && (
                <p className="break-words font-bold text-amber-300">🏆 Sieger: {teamName(teams.find((team) => team.id === (current.winnerTeamId ?? current.winnerId) || team.playerIds.includes(current.winnerId ?? '')))}</p>
              )}
            </div>

            {current.type !== 'ko' && (
              <div>
                <h4 className="mb-2 font-bold text-white">Tabelle</h4>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Turniertabelle, bei Bedarf seitlich scrollen">
                  <table className="w-full text-left text-xs text-emerald-200">
                    <thead className="text-emerald-400"><tr>
                      <th className="p-2" scope="col">#</th><th className="p-2" scope="col">Team</th>
                      <th className="p-2" scope="col"><abbr title="Spiele">Sp.</abbr></th>
                      <th className="p-2" scope="col"><abbr title="Siege">S</abbr></th>
                      <th className="p-2" scope="col">Tore</th><th className="p-2" scope="col"><abbr title="Punkte">Pkt.</abbr></th>
                    </tr></thead>
                    <tbody>{standings.map((standing, index) => <tr key={standing.team.id} className="border-t border-emerald-900">
                      <td className="p-2 text-amber-300">{index + 1}</td>
                      <th className="min-w-[100px] break-words p-2 font-medium text-white" scope="row">{teamName(standing.team)}</th>
                      <td className="p-2">{standing.games}</td><td className="p-2">{standing.wins}</td>
                      <td className="whitespace-nowrap p-2">{standing.scored}:{standing.conceded}</td>
                      <td className="p-2 font-bold text-amber-300">{standing.points}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-bold text-white">Spielplan</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Runde auswählen">
                {rounds.map((round) => <button key={round} type="button" aria-pressed={activeRound === round}
                  onClick={() => setSelectedRound(round)}
                  className={`${buttonClass} border ${activeRound === round ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-emerald-800 text-emerald-300'}`}>
                  {roundTitle(round, lastRound, current.type === 'ko')}
                </button>)}
              </div>
              <h5 className="text-sm font-bold text-amber-300">{activeRound ? roundTitle(activeRound, lastRound, current.type === 'ko') : 'Noch keine Spiele'}</h5>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {current.matches.filter((match) => match.round === activeRound).sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0)).map((match, index) => {
                  const a = fixtureTeam(match, 'A', teams);
                  const b = fixtureTeam(match, 'B', teams);
                  const winner = winningTeamId(match, teams);
                  return (
                    <article key={match.id} className="min-w-0 rounded-xl border border-emerald-800 bg-emerald-950/60 p-3">
                      <p className="mb-2 text-xs text-emerald-400">Spiel {index + 1} · {winner ? 'Gewertet' : a && b ? 'Bereit' : 'Wartet auf vorherige Runde'}</p>
                      {([{ team: a, score: match.scoreA }, { team: b, score: match.scoreB }]).map((side, sideIndex) => (
                        <div key={sideIndex} className={`flex min-w-0 items-start justify-between gap-3 py-2 text-sm ${side.team && side.team.id === winner ? 'font-bold text-amber-300' : 'text-white'}`}>
                          <span className="min-w-0 break-words">{teamName(side.team)}</span>
                          <span className="shrink-0 font-mono">{side.score ?? '–'}</span>
                        </div>
                      ))}
                      {canManage && a && b && <button type="button" className={`${buttonClass} mt-2 w-full bg-emerald-800 text-white`}
                        onClick={() => {
                          setScoring({ tournamentId: current.id, matchId: match.id });
                          setScoreA(String(match.scoreA ?? 10));
                          setScoreB(String(match.scoreB ?? 7));
                          setCorrectionConfirmed(false);
                          setScoreError('');
                        }}>{winner ? 'Ergebnis korrigieren' : 'Ergebnis eintragen'}</button>}
                    </article>
                  );
                })}
              </div>
            </div>
            <details className="border-t border-emerald-900 pt-3">
              <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-bold text-emerald-300">Teams & feste Besetzung ({teams.length})</summary>
              <ul className="space-y-2 text-sm text-white">{teams.map((team, index) => <li key={team.id} className="break-words rounded-lg bg-emerald-950 p-3">
                <span className="text-emerald-400">Team {index + 1}: </span>{teamName(team)}
                <span className="mt-1 block break-all text-[10px] text-emerald-400">ID: {team.id}</span>
              </li>)}</ul>
            </details>
          </section>
        </>
      )}

      {showCreate && (
        <Modal title="Neues Turnier" busy={creating} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4" aria-busy={creating}>
            <fieldset disabled={creating} className="min-w-0 space-y-4">
              <div><label htmlFor="tournament-name" className="mb-1 block text-sm text-emerald-300">Turniername</label>
                <input id="tournament-name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></div>
              <div><label htmlFor="tournament-description" className="mb-1 block text-sm text-emerald-300">Beschreibung</label>
                <textarea id="tournament-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} rows={2} /></div>
              <div><label htmlFor="tournament-type" className="mb-1 block text-sm text-emerald-300">Turnierart</label>
                <select id="tournament-type" value={type} onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'ko' || value === 'groups' || value === 'round_robin') setType(value);
                }} className={fieldClass}>
                  <option value="ko">K.-o.-Turnier</option><option value="groups">Gruppen · Jeder gegen jeden</option><option value="round_robin">Jeder gegen jeden</option>
                </select></div>
              <div><label htmlFor="tournament-mode" className="mb-1 block text-sm text-emerald-300">Modus</label>
                <select id="tournament-mode" value={mode} onChange={(event) => {
                  const value = event.target.value;
                  if (value !== '1v1' && value !== '2v2') return;
                  setMode(value);
                  setDraftTeams([]);
                  setCreateError('');
                }} className={fieldClass}>
                  <option value="1v1">Einzel (1v1)</option><option value="2v2">Doppel (2v2) · Feste Paare</option>
                </select>
                {draftTeams.length > 0 && <p className="mt-1 text-xs text-emerald-300">Ein Moduswechsel leert die Teamauswahl.</p>}
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-white">Teams zusammenstellen ({draftTeams.length})</h4>
                <p className="text-xs text-emerald-300">{type === 'ko' ? '2, 4, 8, 16, 32 oder 64 Teams.' : 'Mindestens 2 Teams.'} {mode === '2v2' ? 'Genau zwei feste Spieler pro Team.' : 'Ein Spieler pro Team.'} Jeder Spieler darf nur einmal antreten.</p>
                {draftTeams.map((team, index) => <fieldset key={team.id} className="min-w-0 space-y-2 rounded-xl border border-emerald-800 p-3">
                  <legend className="px-1 text-sm font-bold text-amber-200">Team {index + 1}</legend>
                  {Array.from({ length: teamSize }, (_, slot) => {
                    const inputId = `team-${team.id}-${slot}`;
                    return <div key={slot}>
                      <label htmlFor={inputId} className="mb-1 block text-xs text-emerald-300">Spieler {slot + 1}</label>
                      <select id={inputId} required value={team.playerIds[slot] ?? ''} onChange={(event) => updateTeamPlayer(team.id, slot, event.target.value)} className={fieldClass}>
                        <option value="">Spieler auswählen</option>
                        {eligiblePlayers.map((player) => <option key={player.id} value={player.id}
                          disabled={draftTeams.some((other) => other.playerIds.some((id, otherSlot) => id === player.id && (other.id !== team.id || otherSlot !== slot)))}>
                          {player.name}
                        </option>)}
                      </select>
                    </div>;
                  })}
                  <button type="button" className={`${buttonClass} w-full bg-red-950/60 text-red-200`}
                    onClick={() => setDraftTeams((previous) => previous.filter((other) => other.id !== team.id))}>Team entfernen</button>
                </fieldset>)}
                <button type="button" disabled={draftTeams.length >= 64 || (draftTeams.length + 1) * teamSize > eligiblePlayers.length}
                  onClick={() => setDraftTeams((previous) => [...previous, { id: crypto.randomUUID(), playerIds: Array.from({ length: teamSize }, () => '') }])}
                  className={`${buttonClass} w-full border border-emerald-700 text-emerald-200`}>Team hinzufügen</button>
                {eligiblePlayers.length < teamSize * 2 && <p className="text-sm text-amber-200">Zu wenige aktive Spieler für diesen Modus.</p>}
              </div>
            </fieldset>
            {createError && <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{createError}</p>}
            <button type="submit" disabled={creating || !canManage} className={`${buttonClass} w-full bg-amber-400 text-stone-950`}>{creating ? 'Wird gespeichert…' : 'Turnier erstellen'}</button>
          </form>
        </Modal>
      )}
      {scoring && (
        <Modal title={isCorrection ? 'Ergebnis korrigieren' : 'Ergebnis eintragen'} busy={saving} onClose={() => setScoring(null)}>
          <form onSubmit={handleScore} className="space-y-4" aria-busy={saving}>
            {!scoringMatch ? <p role="alert" className="text-sm text-red-200">Das Spiel ist nicht mehr verfügbar.</p> : (
              <fieldset disabled={saving} className="min-w-0 space-y-4">
                <p className="text-xs text-emerald-300">{scoringTournament?.mode === '2v2' ? 'Doppel · Feste Paare' : 'Einzel'}</p>
                {(['A', 'B'] as const).map((side) => <div key={side}>
                  <label htmlFor={`tournament-score-${side}`} className="mb-2 block break-words text-sm font-bold text-white">{teamName(fixtureTeam(scoringMatch, side, scoringTeams))}</label>
                  <input id={`tournament-score-${side}`} type="number" inputMode="numeric" required min={0} max={10} step={1}
                    value={side === 'A' ? scoreA : scoreB} onChange={(event) => side === 'A' ? setScoreA(event.target.value) : setScoreB(event.target.value)}
                    className={`${fieldClass} font-mono`} />
                </div>)}
                {isCorrection && <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
                  <p>Eine Korrektur ersetzt das Ligaergebnis. Nachfolgende K.-o.-Spiele und ihre Ligaergebnisse werden zurückgesetzt – auch bereits abgeschlossene Spiele. Die Tabelle wird neu berechnet.</p>
                  <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-3 py-2">
                    <input type="checkbox" checked={correctionConfirmed} onChange={(event) => setCorrectionConfirmed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-amber-400" />
                    <span>Ich bestätige die Korrektur und ihre Auswirkungen.</span>
                  </label>
                </div>}
              </fieldset>
            )}
            {scoreError && <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{scoreError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => setScoring(null)} className={`${buttonClass} bg-stone-800 text-white`}>Abbrechen</button>
              <button type="submit" disabled={saving || !canManage || !scoringMatch || (isCorrection && !correctionConfirmed)} className={`${buttonClass} bg-amber-400 text-stone-950`}>{saving ? 'Speichert…' : 'Speichern'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
