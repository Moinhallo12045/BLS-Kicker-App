'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Tournament, TournamentMatch, MatchMode } from '@/types';
import { Crown, Trophy, Users, Plus, Check, Play, ChevronRight, Award } from 'lucide-react';

export function TournamentView() {
  const { tournaments, players, currentUser, createTournament, advanceTournamentMatch } = useStore();
  const [selectedTourneyId, setSelectedTourneyId] = useState<string>(tournaments[0]?.id || '');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Tournament Form State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'ko' | 'groups' | 'round_robin'>('ko');
  const [newMode, setNewMode] = useState<MatchMode>('1v1');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    players.slice(0, 8).map((p) => p.id)
  );

  // Match scoring modal state
  const [activeScoringMatch, setActiveScoringMatch] = useState<TournamentMatch | null>(null);
  const [scoreA, setScoreA] = useState(10);
  const [scoreB, setScoreB] = useState(7);

  const currentTourney = tournaments.find((t) => t.id === selectedTourneyId) || tournaments[0];

  const getPlayer = (id?: string) => (id ? players.find((p) => p.id === id) : null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || selectedParticipants.length < 2) return;

    createTournament({
      name: newName.trim(),
      description: newDesc.trim() || 'Offizielles Liga-Turnier',
      type: newType,
      mode: newMode,
      participants: selectedParticipants,
    });

    setShowCreateModal(false);
    setNewName('');
    setNewDesc('');
  };

  const handleScoreSubmit = () => {
    if (!activeScoringMatch || !currentTourney) return;
    advanceTournamentMatch(currentTourney.id, activeScoringMatch.id, scoreA, scoreB);
    setActiveScoringMatch(null);
  };

  // Group matches by round for K.O. view
  const roundsMap: { [round: number]: TournamentMatch[] } = {};
  if (currentTourney && currentTourney.type === 'ko') {
    currentTourney.matches.forEach((m) => {
      if (!roundsMap[m.round]) roundsMap[m.round] = [];
      roundsMap[m.round].push(m);
    });
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            Turniermodus
          </h2>
          <p className="text-xs text-emerald-300/80">
            K.O.-Bäume, Gruppenphasen & Jeder-gegen-Jeden Meisterschaften
          </p>
        </div>

        {(['owner', 'co_owner', 'admin', 'organiser'].includes(currentUser?.role || '')) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Neues Turnier
          </button>
        )}
      </div>

      {/* Tournament Selector Carousel */}
      <div className="overflow-x-auto no-scrollbar flex items-center gap-2 pb-1">
        {tournaments.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTourneyId(t.id)}
            className={`px-4 py-2.5 rounded-xl text-left border transition-all whitespace-nowrap shrink-0 ${
              currentTourney?.id === t.id
                ? 'bg-emerald-950/90 border-amber-400 text-white shadow-lg'
                : 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">{t.name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                  t.status === 'running'
                    ? 'bg-emerald-500/20 text-neon-lime'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {t.status === 'running' ? 'Läuft' : 'Geplant'}
              </span>
            </div>
            <div className="text-[10px] text-emerald-400/60 mt-0.5">
              {t.type === 'ko' ? 'K.O.-Baum' : t.type === 'groups' ? 'Gruppenphase' : 'Liga-Modus'} • {t.participants.length} Teilnehmer
            </div>
          </button>
        ))}
      </div>

      {currentTourney && (
        <div className="felt-card p-5 space-y-6">
          {/* Tournament Overview Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/40 pb-4">
            <div>
              <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                {currentTourney.name}
              </h3>
              <p className="text-xs text-emerald-300/80 mt-1 max-w-xl">
                {currentTourney.description}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-[#07160f] border border-emerald-800/60 text-emerald-300">
                Modus: <strong>{currentTourney.mode}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#07160f] border border-emerald-800/60 text-amber-300">
                Typ: <strong>{currentTourney.type.toUpperCase()}</strong>
              </div>
            </div>
          </div>

          {/* Interactive K.O. Bracket View */}
          {currentTourney.type === 'ko' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>Turnierbaum (K.O.-System)</span>
                <span className="text-[10px] text-emerald-400/60">
                  Klicke auf ein Match um das Ergebnis einzutragen
                </span>
              </div>

              <div className="overflow-x-auto pb-4">
                <div className="flex items-start gap-8 min-w-[600px] py-2">
                  {Object.keys(roundsMap).map((roundKey) => {
                    const roundNum = Number(roundKey);
                    const roundMatches = roundsMap[roundNum];
                    const roundTitle =
                      roundNum === 1
                        ? 'Viertelfinale'
                        : roundNum === 2
                        ? 'Halbfinale'
                        : roundNum === 3
                        ? 'Finale'
                        : `Runde ${roundNum}`;

                    return (
                      <div key={roundNum} className="flex-1 space-y-4">
                        <div className="text-center text-xs font-bold uppercase tracking-wider text-amber-400/90 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40">
                          {roundTitle}
                        </div>

                        <div className="space-y-4">
                          {roundMatches.map((m) => {
                            const pA = getPlayer(m.playerAId);
                            const pB = getPlayer(m.playerBId);
                            const isDone = m.winnerId !== undefined;

                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  if (pA && pB) {
                                    setActiveScoringMatch(m);
                                    setScoreA(m.scoreA || 10);
                                    setScoreB(m.scoreB || 7);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                  isDone
                                    ? 'bg-[#081f14] border-emerald-700/60 shadow'
                                    : pA && pB
                                    ? 'bg-emerald-950/80 border-amber-500/40 hover:border-amber-400 hover:scale-[1.02]'
                                    : 'bg-emerald-950/30 border-emerald-900/40 opacity-60'
                                }`}
                              >
                                {/* Player A */}
                                <div
                                  className={`flex items-center justify-between text-xs py-1 px-1.5 rounded ${
                                    m.winnerId === pA?.id
                                      ? 'font-bold text-amber-300 bg-amber-500/10'
                                      : 'text-stone-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span>{pA?.avatar || '👤'}</span>
                                    <span className="truncate">{pA?.name || 'TBD'}</span>
                                  </div>
                                  <span className="font-mono font-bold">
                                    {m.scoreA !== undefined ? m.scoreA : '-'}
                                  </span>
                                </div>

                                <div className="border-t border-emerald-900/40 my-1" />

                                {/* Player B */}
                                <div
                                  className={`flex items-center justify-between text-xs py-1 px-1.5 rounded ${
                                    m.winnerId === pB?.id
                                      ? 'font-bold text-amber-300 bg-amber-500/10'
                                      : 'text-stone-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span>{pB?.avatar || '👤'}</span>
                                    <span className="truncate">{pB?.name || 'TBD'}</span>
                                  </div>
                                  <span className="font-mono font-bold">
                                    {m.scoreB !== undefined ? m.scoreB : '-'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Round Robin Table View */}
          {currentTourney.type === 'round_robin' && (
            <div className="space-y-4">
              <div className="text-xs font-bold text-emerald-300">
                Tabelle: Jeder gegen Jeden
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#07160f] text-emerald-400 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-2.5">Platz</th>
                      <th className="p-2.5">Spieler</th>
                      <th className="p-2.5 text-center">Spiele</th>
                      <th className="p-2.5 text-center">S</th>
                      <th className="p-2.5 text-center">N</th>
                      <th className="p-2.5 text-center">Tore</th>
                      <th className="p-2.5 text-right">Punkte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-900/30">
                    {currentTourney.participants.map((pid, idx) => {
                      const p = getPlayer(pid);
                      return (
                        <tr key={pid} className="hover:bg-emerald-950/40">
                          <td className="p-2.5 font-bold text-amber-400">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-white flex items-center gap-2">
                            <span>{p?.avatar}</span>
                            <span>{p?.name}</span>
                          </td>
                          <td className="p-2.5 text-center font-mono">3</td>
                          <td className="p-2.5 text-center text-neon-lime font-mono">2</td>
                          <td className="p-2.5 text-center text-red-400 font-mono">1</td>
                          <td className="p-2.5 text-center font-mono">28 : 22</td>
                          <td className="p-2.5 text-right font-black text-amber-400 text-sm">6</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Scoring Modal */}
      {activeScoringMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="felt-card max-w-sm w-full p-5 space-y-4 border border-amber-400/50 shadow-2xl">
            <h4 className="font-display text-lg font-bold text-white text-center">
              Turnier-Ergebnis eintragen
            </h4>

            <div className="flex items-center justify-around py-3">
              <div className="text-center space-y-1">
                <div className="text-2xl">{getPlayer(activeScoringMatch.playerAId)?.avatar}</div>
                <div className="text-xs font-bold text-white">
                  {getPlayer(activeScoringMatch.playerAId)?.name}
                </div>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={scoreA}
                  onChange={(e) => setScoreA(parseInt(e.target.value) || 0)}
                  className="w-14 h-12 text-center text-2xl font-mono font-black bg-stone-900 border border-emerald-600 rounded-xl text-amber-400 focus:outline-none"
                />
              </div>

              <span className="text-xl font-bold text-emerald-400">:</span>

              <div className="text-center space-y-1">
                <div className="text-2xl">{getPlayer(activeScoringMatch.playerBId)?.avatar}</div>
                <div className="text-xs font-bold text-white">
                  {getPlayer(activeScoringMatch.playerBId)?.name}
                </div>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={scoreB}
                  onChange={(e) => setScoreB(parseInt(e.target.value) || 0)}
                  className="w-14 h-12 text-center text-2xl font-mono font-black bg-stone-900 border border-emerald-600 rounded-xl text-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveScoringMatch(null)}
                className="flex-1 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold text-xs hover:bg-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleScoreSubmit}
                className="flex-1 py-2 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 shadow"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="felt-card max-w-md w-full p-5 space-y-4 border border-amber-500/50 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Neues Turnier anlegen
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-emerald-300 font-semibold mb-1">Turniername</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z.B. Winter-Cup 2026"
                  className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-semibold mb-1">Beschreibung</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Kurze Regel- oder Terminbeschreibung..."
                  className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-emerald-300 font-semibold mb-1">Turnierart</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="ko">K.-o.-Turnier</option>
                    <option value="groups">Gruppenphase</option>
                    <option value="round_robin">Jeder gegen jeden</option>
                  </select>
                </div>

                <div>
                  <label className="block text-emerald-300 font-semibold mb-1">Modus</label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as any)}
                    className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="1v1">Einzel (1v1)</option>
                    <option value="2v2">Doppel (2v2)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  Teilnehmer auswählen ({selectedParticipants.length} ausgewählt)
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-emerald-950/40 rounded-xl border border-emerald-900">
                  {players.map((p) => {
                    const isChecked = selectedParticipants.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedParticipants((prev) =>
                            isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`p-1.5 rounded-lg border text-left text-[11px] flex items-center justify-between transition-colors ${
                          isChecked
                            ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                            : 'bg-emerald-950/40 border-emerald-800/40 text-stone-300'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow-lg"
            >
              Turnier jetzt starten
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
