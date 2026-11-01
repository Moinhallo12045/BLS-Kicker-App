'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { MatchStatus, MatchMode } from '@/types';
import { Swords, CheckCircle2, Clock, AlertTriangle, Filter } from 'lucide-react';

export function MatchesView({ onOpenMatchEntry }: { onOpenMatchEntry: () => void }) {
  const { 
    matches, 
    players, 
    currentUser, 
    acceptDisputeResolution, 
    cancelMatchByMutualAgreement 
  } = useStore();
  const [filterMode, setFilterMode] = useState<'all' | MatchMode>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | MatchStatus>('all');

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const filteredMatches = matches.filter((m) => {
    if (filterMode !== 'all' && m.mode !== filterMode) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Swords className="w-6 h-6 text-amber-400" />
            Spiele & Ergebnisse
          </h2>
          <p className="text-xs text-emerald-300/80">
            Offizielle Historie aller ausgetragenen Liga-Begegnungen
          </p>
        </div>

        <button
          onClick={onOpenMatchEntry}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow flex items-center gap-1.5"
        >
          <span>+</span> Spiel eintragen
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#07160f]/60 p-2 rounded-2xl border border-emerald-900/60">
        <div className="flex items-center gap-1">
          {(['all', '1v1', '2v2'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterMode === m
                  ? 'bg-amber-400 text-stone-950 font-black'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              {m === 'all' ? 'Alle Modi' : m === '1v1' ? '1 gegen 1' : '2 gegen 2'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {(['all', 'confirmed', 'pending', 'disputed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                filterStatus === s
                  ? 'bg-emerald-600 text-white font-black'
                  : 'text-emerald-300/60 hover:text-white'
              }`}
            >
              {s === 'all'
                ? 'Alle Status'
                : s === 'confirmed'
                ? 'Bestätigt'
                : s === 'pending'
                ? 'Ausstehend'
                : 'Strittig'}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-3">
        {filteredMatches.length === 0 ? (
          <div className="felt-card p-8 text-center text-emerald-300/60 text-xs">
            Keine Spiele mit diesen Filterkriterien gefunden.
          </div>
        ) : (
          filteredMatches.map((m) => {
            const teamAPlayers = m.teamA.map((id) => getPlayer(id)).filter(Boolean);
            const teamBPlayers = m.teamB.map((id) => getPlayer(id)).filter(Boolean);
            const isWinnerA = m.scoreA > m.scoreB;

            return (
              <div
                key={m.id}
                className={`felt-card p-4 transition-all relative overflow-hidden ${
                  m.status === 'disputed'
                    ? 'border-red-600/50 bg-red-950/20'
                    : m.status === 'pending'
                    ? 'border-amber-600/40 bg-amber-950/10'
                    : 'border-emerald-800/40'
                }`}
              >
                {/* Status Header */}
                <div className="flex items-center justify-between text-[11px] mb-3 border-b border-emerald-900/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-400">
                      {m.date}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-300/80 uppercase font-bold text-[10px]">
                      {m.mode}
                    </span>
                  </div>

                  <div>
                    {m.status === 'confirmed' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-neon-lime border border-emerald-500/30 font-bold flex items-center gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Bestätigt
                      </span>
                    )}
                    {m.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-1 text-[10px]">
                        <Clock className="w-3 h-3" />
                        Ausstehend
                      </span>
                    )}
                    {m.status === 'disputed' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold flex items-center gap-1 text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        Strittig
                      </span>
                    )}
                  </div>
                </div>

                {/* Score & Teams Arena Display */}
                <div className="grid grid-cols-7 items-center gap-2">
                  {/* Team A */}
                  <div className="col-span-3 text-right">
                    <div className="space-y-0.5">
                      {teamAPlayers.map((p) => (
                        <div
                          key={p?.id}
                          className={`text-xs font-bold ${
                            isWinnerA ? 'text-amber-300' : 'text-slate-300'
                          }`}
                        >
                          {p?.name}
                        </div>
                      ))}
                    </div>
                    {m.status === 'confirmed' && m.eloChangeA !== 0 && (
                      <div
                        className={`text-[10px] font-mono font-bold mt-1 ${
                          m.eloChangeA > 0 ? 'text-neon-lime' : 'text-red-400'
                        }`}
                      >
                        {m.eloChangeA > 0 ? `+${m.eloChangeA}` : m.eloChangeA} ELO
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-1 text-center">
                    <div className="font-mono text-xl font-black text-white bg-[#06140d] px-2 py-1 rounded-xl border border-emerald-800/60 shadow-inner">
                      {m.scoreA}:{m.scoreB}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="col-span-3 text-left">
                    <div className="space-y-0.5">
                      {teamBPlayers.map((p) => (
                        <div
                          key={p?.id}
                          className={`text-xs font-bold ${
                            !isWinnerA ? 'text-amber-300' : 'text-slate-300'
                          }`}
                        >
                          {p?.name}
                        </div>
                      ))}
                    </div>
                    {m.status === 'confirmed' && m.eloChangeB !== 0 && (
                      <div
                        className={`text-[10px] font-mono font-bold mt-1 ${
                          m.eloChangeB > 0 ? 'text-neon-lime' : 'text-red-400'
                        }`}
                      >
                        {m.eloChangeB > 0 ? `+${m.eloChangeB}` : m.eloChangeB} ELO
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispute Reason & Peer Resolution */}
                {m.status === 'disputed' && (
                  <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-700/50 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-red-300 font-bold">
                        Strittig gemeldet: {m.disputeReason}
                      </span>
                      {m.disputeProposedScoreA !== undefined && m.disputeProposedScoreB !== undefined && (
                        <span className="font-mono text-amber-300 font-bold bg-stone-900 px-2 py-0.5 rounded border border-amber-600/40">
                          Gegenvorschlag: {m.disputeProposedScoreA} : {m.disputeProposedScoreB}
                        </span>
                      )}
                    </div>

                    {(m.teamA.includes(currentUser?.id || '') || m.teamB.includes(currentUser?.id || '')) && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-900/40 text-xs">
                        <button
                          onClick={() => {
                            if (confirm('Dieses Spiel im Einvernehmen streichen?')) {
                              cancelMatchByMutualAgreement(m.id);
                            }
                          }}
                          className="px-2.5 py-1 text-red-300 hover:text-white rounded bg-red-900/40"
                        >
                          Spiel streichen
                        </button>

                        {m.disputeProposedBy !== currentUser?.id &&
                          m.disputeProposedScoreA !== undefined &&
                          m.disputeProposedScoreB !== undefined && (
                            <button
                              onClick={() => acceptDisputeResolution(m.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow"
                            >
                              Gegenvorschlag ({m.disputeProposedScoreA}:{m.disputeProposedScoreB}) annehmen
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
