'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { gamesPlayed, isMatchCounted, teamOf } from '@/lib/matchViews';
import { ProfileView } from './ProfileView';
import { PlayersView } from './PlayersView';
import { MatchesView } from './MatchesView';
import { ConfirmationDrawer } from './ConfirmationDrawer';
import { PlayerLink, useAppNavigation } from './AppNavigation';

export function DetailBack() {
  const { back } = useAppNavigation();
  return <button type="button" onClick={back} className="min-h-[44px] text-sm font-bold text-amber-300 hover:underline">← Zurück</button>;
}

export function PlayerDetailView({ playerId, onOpenMatchEntry }: { playerId: string; onOpenMatchEntry: () => void }) {
  const { players, isLoading } = useStore();
  const player = players.find((entry) => entry.id === playerId);
  if (!player) return <div><DetailBack /><p role="status" className="felt-card p-5 text-emerald-200">{isLoading ? 'Spieler wird geladen…' : 'Spieler nicht gefunden.'}</p></div>;
  const total = gamesPlayed(player);
  const wins = player.wins1v1 + player.wins2v2;
  const history = [...player.eloHistory].sort((a, b) => a.date.localeCompare(b.date));
  const min = Math.min(...history.map((entry) => entry.elo), player.eloTotal);
  const max = Math.max(...history.map((entry) => entry.elo), player.eloTotal);
  const points = history.map((entry, index) => `${history.length > 1 ? 10 + index / (history.length - 1) * 280 : 150},${90 - (entry.elo - min) / Math.max(1, max - min) * 70}`).join(' ');
  return <div className="space-y-5">
    <DetailBack />
    <ProfileView playerId={playerId} />
    <div className="felt-card p-4 grid grid-cols-3 gap-3 text-center text-sm text-emerald-200">
      <div>Gesamt-Elo<strong className="block text-lg text-amber-300">{player.eloTotal}</strong></div>
      <div>Spiele<strong className="block text-lg text-white">{total}</strong></div>
      <div>Siegquote<strong className="block text-lg text-white">{total ? `${Math.round(wins / total * 100)} %` : '–'}</strong></div>
    </div>
    <section className="felt-card p-4 space-y-3">
      <h3 className="font-display text-lg font-bold text-white">Elo-Verlauf</h3>
      {history.length === 0 ? <p className="text-sm text-emerald-300">Noch kein Elo-Verlauf vorhanden.</p> : <>
        <p className="text-xs text-emerald-300">{history[0].date} bis {history[history.length - 1].date} · Aktuell {player.eloTotal} Elo</p>
        <svg viewBox="0 0 300 110" role="img" aria-label={`Elo-Verlauf von ${player.name}: ${history[0].elo} bis ${history[history.length - 1].elo} Elo`} className="w-full h-40">
          <polyline points={points} fill="none" stroke="#fbbf24" strokeWidth="2" />
          {history.length === 1 && <circle cx="150" cy="90" r="3" fill="#fbbf24" />}
        </svg>
        <details className="text-xs text-emerald-200">
          <summary className="min-h-[44px] cursor-pointer py-3">Werte anzeigen</summary>
          <ul>{history.map((entry, index) => <li key={`${entry.date}-${index}`} className="flex justify-between py-1"><span>{entry.date}</span><span>{entry.elo} Elo</span></li>)}</ul>
        </details>
      </>}
    </section>
    <PlayersView key={playerId} comparePlayerId={playerId} />
    <MatchesView key={`matches-${playerId}`} playerId={playerId} onOpenMatchEntry={onOpenMatchEntry} />
  </div>;
}

export function MatchDetailView({ matchId, onOpenMatchEntry }: { matchId: string; onOpenMatchEntry: () => void }) {
  const { matches, players, tournaments, currentUser, isLoading } = useStore();
  const { openTournament } = useAppNavigation();
  const [actionsOpen, setActionsOpen] = useState(false);
  const match = matches.find((entry) => entry.id === matchId);
  if (!match) return <div><DetailBack /><p role="status" className="felt-card p-5 text-emerald-200">{isLoading ? 'Spiel wird geladen…' : 'Spiel nicht gefunden.'}</p></div>;
  const playerName = (id: string) => players.find((player) => player.id === id)?.name || 'Unbekannter Spieler';
  const tournament = tournaments.find((entry) => entry.id === match.tournamentId);
  const counted = isMatchCounted(match);
  const participant = teamOf(match, currentUser?.id) !== null;
  return <div className="space-y-5">
    <DetailBack />
    <h2 className="font-display text-2xl font-bold text-white">Spielinformationen</h2>
    <MatchesView matchId={matchId} onOpenMatchEntry={onOpenMatchEntry} />
    <section className="felt-card p-4 space-y-3 text-sm text-emerald-200">
      <h3 className="font-display text-lg font-bold text-white">Details & Wertung</h3>
      <p className={counted ? 'text-emerald-300' : 'text-amber-300'}>{counted ? 'Dieses Spiel wird in der Statistik gewertet.' : 'Dieses Spiel wird nicht gewertet.'}</p>
      <dl className="space-y-2">
        <div><dt className="text-emerald-400 text-xs">Eingetragen von</dt><dd><PlayerLink id={match.creatorId}>{playerName(match.creatorId)}</PlayerLink></dd></div>
        {match.createdAt && <div><dt className="text-emerald-400 text-xs">Erfasst am</dt><dd>{new Date(match.createdAt).toLocaleString('de-DE', { timeZone: 'UTC' })} (UTC)</dd></div>}
        <div><dt className="text-emerald-400 text-xs">Als gesehen markiert von</dt><dd>{match.confirmedBy.length ? match.confirmedBy.map((id) => <span key={id} className="mr-3"><PlayerLink id={id}>{playerName(id)}</PlayerLink></span>) : 'Noch niemandem'}</dd></div>
        {match.status === 'disputed' && match.disputedBy && <div><dt className="text-emerald-400 text-xs">Widerspruch von</dt><dd><PlayerLink id={match.disputedBy}>{playerName(match.disputedBy)}</PlayerLink></dd></div>}
        {match.status === 'disputed' && match.disputeProposedBy && <div><dt className="text-emerald-400 text-xs">Ergebnisvorschlag von</dt><dd><PlayerLink id={match.disputeProposedBy}>{playerName(match.disputeProposedBy)}</PlayerLink></dd></div>}
        {match.cancellationRequestedBy && match.status !== 'cancelled' && <div><dt className="text-emerald-400 text-xs">Streichung beantragt von</dt><dd><PlayerLink id={match.cancellationRequestedBy}>{playerName(match.cancellationRequestedBy)}</PlayerLink></dd></div>}
      </dl>
      {match.tournamentId && <p>Turnier: {tournament ? <button type="button" onClick={() => openTournament(tournament.id)} className="min-h-[44px] text-amber-300 hover:underline">{tournament.name}</button> : 'Turnier nicht mehr verfügbar'}</p>}
      {participant && !match.tournamentId && match.status !== 'cancelled' && <button type="button" onClick={() => setActionsOpen(true)}
        className="min-h-[44px] px-4 rounded-xl bg-emerald-700 text-white font-bold">Ergebnis prüfen / Widerspruch</button>}
    </section>
    <ConfirmationDrawer isOpen={actionsOpen} onClose={() => setActionsOpen(false)} matchId={matchId} />
  </div>;
}
