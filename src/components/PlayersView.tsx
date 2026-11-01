'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Search, Swords, Trophy, X } from 'lucide-react';
import { getTierForLevel } from '@/lib/levels';
import { didPlayerWin, gamesPlayed, isMatchCounted, isOpposingSide } from '@/lib/matchViews';

export function PlayersView() {
  const { players, matches, currentUser } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  // Always resolve from current store state so details never go stale.
  const selectedPlayer = selectedId ? players.find((p) => p.id === selectedId) || null : null;
  const compareCandidates = selectedPlayer ? players.filter((p) => p.id !== selectedPlayer.id) : [];
  const comparePlayer =
    compareCandidates.find((p) => p.id === compareId) || null;

  useEffect(() => {
    if (selectedId && !selectedPlayer) setSelectedId(null);
  }, [selectedId, selectedPlayer]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const query = searchQuery.trim().toLowerCase();
  const filtered = players.filter((p) => p.name.toLowerCase().includes(query));

  const openPlayer = (playerId: string) => {
    setSelectedId(playerId);
    const others = players.filter((p) => p.id !== playerId);
    const defaultCompare =
      currentUser && currentUser.id !== playerId ? currentUser.id : others[0]?.id || null;
    setCompareId(defaultCompare);
  };

  const h2hMatches =
    selectedPlayer && comparePlayer
      ? matches.filter((m) => isMatchCounted(m) && isOpposingSide(m, selectedPlayer.id, comparePlayer.id))
      : [];
  const h2hWinsA = selectedPlayer ? h2hMatches.filter((m) => didPlayerWin(m, selectedPlayer.id)).length : 0;
  const h2hWinsB = h2hMatches.length - h2hWinsA;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          Spieler-Community
        </h2>
        <p className="text-xs text-emerald-300/80">
          Entdecke alle {players.length} registrierten Kicker-Kollegen und vergleiche direkte Duelle
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Spieler nach Namen durchsuchen..."
          aria-label="Spieler suchen"
          className="w-full min-h-[44px] bg-emerald-950/70 border border-emerald-800/60 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-emerald-400/50 focus:outline-none focus:border-amber-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="felt-card p-6 text-center text-xs text-emerald-300/60">Keine Spieler gefunden.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((p) => {
          const tier = getTierForLevel(p.level);
          const totalMatches = gamesPlayed(p);
          const winRate = totalMatches > 0 ? Math.round(((p.wins1v1 + p.wins2v2) / totalMatches) * 100) : 0;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openPlayer(p.id)}
              className="felt-card p-3.5 text-left hover:border-emerald-500/60 transition-all flex items-center justify-between gap-3 min-h-[44px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#193d2b] to-[#0c2016] border border-emerald-600/50 flex items-center justify-center text-2xl shadow">
                    {p.avatar}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 px-1.5 rounded-full text-[9px] font-black border border-stone-900 shadow"
                    style={{ backgroundColor: tier.color, color: '#09150f' }}
                  >
                    Lvl {p.level}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-white text-sm truncate">{p.name}</span>
                    {p.currentStreak >= 3 && (
                      <span className="text-[10px] text-amber-400 font-bold shrink-0">🔥{p.currentStreak}</span>
                    )}
                    {p.isSuspended && (
                      <span className="text-[9px] px-1 rounded bg-red-900/50 text-red-300 font-bold shrink-0">Gesperrt</span>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-400/70 truncate">
                    {tier.tier} • Uni-Jg. {p.yearJoined}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-sm font-black text-amber-400">{p.eloTotal} ELO</div>
                <div className="text-[10px] text-emerald-400/70">
                  {totalMatches > 0 ? `${winRate}% Siegquote` : 'Noch keine Spiele'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPlayer && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="h2h-title"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="modal-panel felt-card max-w-lg p-4 sm:p-5 space-y-4 border border-emerald-500/50 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-emerald-900/40 pb-2">
              <h3 id="h2h-title" className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-400" />
                Direkter Vergleich
              </h3>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Schließen"
                className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!comparePlayer ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 text-center text-xs text-emerald-300/70">
                Für einen Vergleich wird mindestens ein weiterer Spieler benötigt.
              </div>
            ) : (
              <>
                <div className="wood-panel p-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                    <div className="space-y-1 min-w-0">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950 border-2 border-amber-400 flex items-center justify-center text-2xl shadow">
                        {selectedPlayer.avatar}
                      </div>
                      <div className="font-bold text-white text-xs truncate">{selectedPlayer.name}</div>
                      <div className="text-[10px] text-amber-400 font-mono font-bold">{selectedPlayer.eloTotal} ELO</div>
                    </div>

                    <div className="space-y-1 px-1">
                      <div className="text-xl font-mono font-black text-white whitespace-nowrap">
                        {h2hWinsA} : {h2hWinsB}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">Siege</div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-2xl shadow">
                        {comparePlayer.avatar}
                      </div>
                      <div className="font-bold text-white text-xs truncate">{comparePlayer.name}</div>
                      <div className="text-[10px] text-amber-400 font-mono font-bold">{comparePlayer.eloTotal} ELO</div>
                    </div>
                  </div>

                  <label className="mt-3 pt-3 border-t border-[#7e4b27]/40 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[11px] text-emerald-200">Gegner wechseln:</span>
                    <select
                      value={comparePlayer.id}
                      onChange={(e) => setCompareId(e.target.value)}
                      className="min-h-[44px] bg-emerald-950 border border-emerald-800 rounded-lg px-2 text-xs text-amber-300 font-semibold focus:outline-none"
                    >
                      {compareCandidates.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-emerald-300">Gewertete direkte Duelle ({h2hMatches.length})</div>
                  {h2hMatches.length === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-950/40 text-center text-xs text-emerald-400/60">
                      Bisher noch keine gewerteten direkten Duelle.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain pr-1">
                      {h2hMatches.map((m) => {
                        const won = didPlayerWin(m, selectedPlayer.id);
                        return (
                          <div
                            key={m.id}
                            className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-between text-xs"
                          >
                            <span className="text-emerald-400 text-[10px]">
                              {m.date} ({m.mode}){m.tournamentId ? ' · Turnier' : ''}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">
                                {m.scoreA} : {m.scoreB}
                              </span>
                              <span className={`text-[10px] font-bold ${won ? 'text-neon-lime' : 'text-red-400'}`}>
                                {won ? `Sieg ${selectedPlayer.name}` : `Sieg ${comparePlayer.name}`}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="w-full min-h-[44px] rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 hover:text-white font-bold text-xs"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
