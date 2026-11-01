'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Player } from '@/types';
import { Search, Swords, Trophy, Flame, ChevronRight, Award, Shield } from 'lucide-react';
import { getTierForLevel } from '@/lib/levels';

export function PlayersView() {
  const { players, matches, currentUser } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [comparePlayer, setComparePlayer] = useState<Player | null>(null);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate direct H2H matches between selectedPlayer and comparePlayer
  const h2hMatches =
    selectedPlayer && comparePlayer
      ? matches.filter((m) => {
          const inA = m.teamA.includes(selectedPlayer.id) && m.teamB.includes(comparePlayer.id);
          const inB = m.teamB.includes(selectedPlayer.id) && m.teamA.includes(comparePlayer.id);
          return inA || inB;
        })
      : [];

  const h2hWinsA = h2hMatches.filter((m) => {
    const isWinnerA = m.scoreA > m.scoreB;
    return (m.teamA.includes(selectedPlayer?.id || '') && isWinnerA) ||
      (m.teamB.includes(selectedPlayer?.id || '') && !isWinnerA);
  }).length;

  const h2hWinsB = h2hMatches.length - h2hWinsA;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          Spieler-Community
        </h2>
        <p className="text-xs text-emerald-300/80">
          Entdecke alle {players.length} registrierten Kicker-Kollegen und vergleiche direkte Duelle
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Spieler nach Namen durchsuchen..."
          className="w-full bg-emerald-950/70 border border-emerald-800/60 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-emerald-400/50 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((p) => {
          const tier = getTierForLevel(p.level);
          const totalMatches = p.wins1v1 + p.losses1v1 + p.wins2v2 + p.losses2v2;
          const winRate =
            totalMatches > 0
              ? Math.round(((p.wins1v1 + p.wins2v2) / totalMatches) * 100)
              : 0;

          return (
            <div
              key={p.id}
              onClick={() => {
                setSelectedPlayer(p);
                setComparePlayer(currentUser && currentUser.id !== p.id ? currentUser : players[0]);
              }}
              className="felt-card p-4 cursor-pointer hover:border-emerald-500/60 hover:scale-[1.01] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#193d2b] to-[#0c2016] border border-emerald-600/50 flex items-center justify-center text-2xl shadow">
                    {p.avatar}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black border border-stone-900 shadow"
                    style={{ backgroundColor: tier.color, color: '#09150f' }}
                  >
                    Lvl {p.level}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">{p.name}</span>
                    {p.currentStreak >= 3 && (
                      <span className="text-[10px] text-amber-400 font-bold flex items-center">
                        🔥{p.currentStreak}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-400/70">
                    {tier.tier} • Uni-Jg. {p.yearJoined}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-sm font-black text-amber-400">
                  {p.eloTotal} ELO
                </div>
                <div className="text-[10px] text-emerald-400/70">
                  {winRate}% Siegquote
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Head-to-Head & Player Detail Modal */}
      {selectedPlayer && comparePlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="felt-card max-w-lg w-full p-5 space-y-4 border border-emerald-500/50 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-400" />
                Direkter Vergleich (Head-to-Head)
              </h3>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-stone-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Duel Arena Card */}
            <div className="wood-panel p-4">
              <div className="grid grid-cols-5 items-center text-center">
                {/* Player 1 */}
                <div className="col-span-2 space-y-1">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950 border-2 border-amber-400 flex items-center justify-center text-2xl shadow">
                    {selectedPlayer.avatar}
                  </div>
                  <div className="font-bold text-white text-xs">{selectedPlayer.name}</div>
                  <div className="text-[10px] text-amber-400 font-mono font-bold">
                    {selectedPlayer.eloTotal} ELO
                  </div>
                </div>

                {/* Score vs Score */}
                <div className="col-span-1 space-y-1">
                  <div className="text-xl font-mono font-black text-white">
                    {h2hWinsA} : {h2hWinsB}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                    Siege
                  </div>
                </div>

                {/* Player 2 */}
                <div className="col-span-2 space-y-1">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-2xl shadow">
                    {comparePlayer.avatar}
                  </div>
                  <div className="font-bold text-white text-xs">{comparePlayer.name}</div>
                  <div className="text-[10px] text-amber-400 font-mono font-bold">
                    {comparePlayer.eloTotal} ELO
                  </div>
                </div>
              </div>

              {/* Selector to switch comparison opponent */}
              <div className="mt-3 pt-3 border-t border-[#7e4b27]/40 flex items-center justify-center gap-2">
                <span className="text-[11px] text-emerald-200">Gegner wechseln:</span>
                <select
                  value={comparePlayer.id}
                  onChange={(e) => {
                    const p = players.find((pl) => pl.id === e.target.value);
                    if (p) setComparePlayer(p);
                  }}
                  className="bg-emerald-950 border border-emerald-800 rounded-lg px-2 py-1 text-xs text-amber-300 font-semibold focus:outline-none"
                >
                  {players
                    .filter((p) => p.id !== selectedPlayer.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Direct Matches List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-emerald-300">
                Gemeinsame Spiele ({h2hMatches.length})
              </div>

              {h2hMatches.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 text-center text-xs text-emerald-400/60">
                  Bisher noch keine direkten Duelle ausgetragen.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {h2hMatches.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-between text-xs"
                    >
                      <span className="text-emerald-400 text-[10px]">{m.date} ({m.mode})</span>
                      <span className="font-mono font-bold text-white">
                        {m.scoreA} : {m.scoreB}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedPlayer(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 hover:text-white font-bold text-xs"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
