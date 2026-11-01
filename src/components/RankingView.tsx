'use client';

import React, { useState } from 'react';
import { Trophy, Flame, ChevronRight, Info, Shield, Award, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Player } from '@/types';

type RankingFilter = 'elo' | 'wochen' | 'level' | 'aktiv' | '1v1' | '2v2';

export function RankingView() {
  const { players, currentUser } = useStore();
  const [activeFilter, setActiveFilter] = useState<RankingFilter>('elo');
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Split into active ranked players (>= 3 matches) and provisional / new players (< 3 matches)
  const isQualifying = (p: Player) => (p.wins1v1 + p.losses1v1 + p.wins2v2 + p.losses2v2) >= 3;

  const qualifiedPlayers = players.filter(isQualifying);
  const newPlayers = players.filter((p) => !isQualifying(p));

  // Sort qualified players according to active filter
  const sortedPlayers = [...qualifiedPlayers].sort((a, b) => {
    switch (activeFilter) {
      case 'elo':
        return b.eloTotal - a.eloTotal;
      case '1v1':
        return b.elo1v1 - a.elo1v1;
      case '2v2':
        return b.elo2v2 - a.elo2v2;
      case 'level':
        return b.level !== a.level ? b.level - a.level : b.xp - a.xp;
      case 'wochen':
      case 'aktiv':
        return b.leaguePoints !== a.leaguePoints
          ? b.leaguePoints - a.leaguePoints
          : b.wins1v1 + b.wins2v2 - (a.wins1v1 + a.wins2v2);
      default:
        return b.eloTotal - a.eloTotal;
    }
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header (Directly matching Screenshot 1) */}
      <div className="text-center pt-2">
        <h2 className="font-display text-3xl font-extrabold text-white tracking-tight">
          Kicker-Rangliste
        </h2>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-300/80">
          <span>Jetzt wird gekickert!</span>
          <span>•</span>
          <button
            onClick={() => setShowRulesModal(true)}
            className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center"
          >
            Regeln & Wertung <ChevronRight className="w-3 h-3 inline" />
          </button>
        </div>
      </div>

      {/* Filter Tabs (Elo, Wochenzocker, Level, Aktivität, Einzel, Doppel) */}
      <div className="overflow-x-auto no-scrollbar flex items-center justify-center gap-2 px-1">
        {[
          { id: 'elo', label: 'Elo' },
          { id: 'wochen', label: 'Wochenzocker' },
          { id: 'level', label: 'Level' },
          { id: 'aktiv', label: 'Aktivität' },
          { id: '1v1', label: 'Einzel' },
          { id: '2v2', label: 'Doppel' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as RankingFilter)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
              activeFilter === tab.id
                ? 'bg-amber-400 text-stone-950 font-black shadow-amber-500/30'
                : 'bg-emerald-950/60 border border-emerald-800/40 text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Wood Frame Leaderboard Card (Directly matching Screenshot 1!) */}
      <div className="wood-panel p-2 sm:p-3">
        <div className="bg-[#0b2115] rounded-xl border border-emerald-700/40 p-2 sm:p-3 space-y-1">
          {sortedPlayers.map((player, idx) => {
            const rank = idx + 1;
            const isMe = player.id === currentUser?.id;
            const totalMatches =
              player.wins1v1 + player.losses1v1 + player.wins2v2 + player.losses2v2;

            // Visual Rank Medal styling (Laurel wreath styling)
            let medalBg = 'bg-stone-800 text-stone-300 border-stone-600';
            if (rank === 1) medalBg = 'bg-gradient-to-b from-amber-300 to-amber-600 text-stone-950 border-amber-300';
            else if (rank === 2) medalBg = 'bg-gradient-to-b from-blue-300 to-blue-600 text-white border-blue-400';
            else if (rank === 3) medalBg = 'bg-gradient-to-b from-orange-400 to-orange-700 text-white border-orange-400';
            else if (rank <= 5) medalBg = 'bg-gradient-to-b from-emerald-600 to-emerald-900 text-white border-emerald-500';

            // Selected value depending on filter
            let mainStat = player.eloTotal;
            let subStat = 'ELO';
            let delta = Math.max(0, player.eloTotal - 1500);

            if (activeFilter === '1v1') mainStat = player.elo1v1;
            else if (activeFilter === '2v2') mainStat = player.elo2v2;
            else if (activeFilter === 'wochen' || activeFilter === 'aktiv') {
              mainStat = player.leaguePoints;
              subStat = 'Punkte';
            } else if (activeFilter === 'level') {
              mainStat = player.level;
              subStat = 'Lvl';
            }

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                  isMe
                    ? 'bg-emerald-900/40 border border-emerald-500/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                    : 'hover:bg-emerald-950/40 border border-transparent'
                }`}
              >
                {/* Left: Medal, Avatar, Name, Level badge, Icons */}
                <div className="flex items-center gap-3">
                  {/* Medal with wreath border */}
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 shadow-md ${medalBg}`}
                    >
                      {rank}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-sm tracking-wide">
                        {player.name}
                      </span>
                      {/* Level in small round pill */}
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-700/60 text-[10px] text-emerald-300 font-bold">
                        {player.level}
                      </span>
                      {/* Crown for #1 */}
                      {rank === 1 && <span className="text-sm">👑</span>}
                      {/* Flame for hot streak */}
                      {player.currentStreak >= 3 && (
                        <span className="text-xs flex items-center text-amber-400 font-bold">
                          🔥 {player.currentStreak}
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] px-1.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                          Du
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-emerald-400/60 font-medium">
                      Uni-Jg. {player.yearJoined} • {player.leaguePoints} Ligapunkte
                    </div>
                  </div>
                </div>

                {/* Right: Elo Delta & Elo Score */}
                <div className="text-right flex items-center gap-2.5">
                  {delta > 0 && (
                    <div className="text-xs font-bold text-neon-lime flex items-center">
                      ▲{delta}
                    </div>
                  )}
                  <div className="font-mono text-base font-black text-white tracking-tight">
                    {mainStat}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Neu dabei – In der Elo-Rangliste ab 3 Spielen (Directly matching Screenshot 3!) */}
      {newPlayers.length > 0 && (
        <div className="felt-card p-4">
          <div className="text-center mb-3">
            <h3 className="font-display text-base font-bold text-white">
              Neu dabei
            </h3>
            <p className="text-[11px] text-emerald-400/80">
              In der Elo-Rangliste ab 3 Spielen
            </p>
          </div>

          <div className="divide-y divide-emerald-900/30">
            {newPlayers.map((np) => {
              const played = np.wins1v1 + np.losses1v1 + np.wins2v2 + np.losses2v2;
              const remaining = Math.max(1, 3 - played);
              return (
                <div key={np.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-400 flex items-center justify-center text-slate-800 text-xs shadow">
                      ⚪
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">{np.name}</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-700/60 text-[10px] text-emerald-300 font-bold">
                          {np.level}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400/60">
                        Uni-Jg. {np.yearJoined}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-emerald-300/80 font-medium">
                    noch {remaining} {remaining === 1 ? 'Spiel' : 'Spiele'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="felt-card max-w-md w-full p-5 space-y-4 border border-emerald-500/50 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-800/40 pb-3">
              <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400" />
                Ligaregeln & Wertung
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-stone-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-emerald-200/90 leading-relaxed">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">
                  1. Spielablauf & Tore
                </h4>
                <p>
                  Gespielt wird klassisch bis <strong>10 Tore</strong> (oder nach Absprache). Ein Unentschieden gibt es nicht.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">
                  2. ELO-Bewertung
                </h4>
                <p>
                  Jeder Spieler startet mit <strong>1.000 ELO-Punkten</strong>. Bei einem Sieg gegen stärkere Gegner gibt es deutlich mehr Punkte. Einzel- und Doppelspiele fließen in getrennte ELO-Werte ein.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">
                  3. Ligapunkte
                </h4>
                <p>
                  Unabhängig vom ELO-System erhält das Siegerteam <strong>3 Ligapunkte</strong>. Niederlage bringt 0 Punkte.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">
                  4. Bestätigungspflicht
                </h4>
                <p>
                  Nach der Eintragung erhält die Gegenseite eine Bestätigungsanfrage. Erst nach Bestätigung wird das Ergebnis offiziell gewertet. Bei Unstimmigkeiten greift die Turnierleitung/Admin ein.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
