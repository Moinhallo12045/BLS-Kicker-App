'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Info, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { ExternalLabel } from './ExternalLabel';
import { Player } from '@/types';
import { RankingFilter } from '@/lib/navigation';
import { weeklyCrawlers } from '@/lib/statistics';
import { PlayerLink, useAppNavigation } from './AppNavigation';
import {
  MIN_RANKED_GAMES,
  computePeriodStats,
  computeTournamentWins,
  gamesPlayed,
  getMonthStartKey,
  getWeekStartKey,
  isQualified,
} from '@/lib/matchViews';

const TABS: { id: RankingFilter; label: string }[] = [
  { id: 'elo', label: 'Elo' },
  { id: 'krabbler', label: '🦀 Krabbler' },
  { id: 'wochen', label: 'Wochenzocker' },
  { id: 'level', label: 'Level' },
  { id: 'aktiv', label: 'Aktivität' },
  { id: '1v1', label: 'Einzel' },
  { id: '2v2', label: 'Doppel' },
  { id: 'monat', label: 'Monat' },
  { id: 'turnier', label: 'Turniere' },
  { id: 'historie', label: 'Bestwert' },
];

const FILTER_HINTS: Partial<Record<RankingFilter, string>> = {
  krabbler: 'Gewertete Zu-null-Niederlagen seit Montag (UTC), auch ohne Ranglistenqualifikation. Bei Gleichstand zählt die höchste Niederlage.',
  wochen: 'Ligapunkte aus gewerteten Spielen dieser Woche (ab Montag)',
  monat: 'Ligapunkte aus gewerteten Spielen dieses Monats',
  aktiv: 'Gewertete Spiele in diesem Monat',
  turnier: 'Gewonnene, abgeschlossene Turniere',
  historie: 'Höchster jemals erreichter ELO-Wert',
};

/** ELO change since the start of the week, based on the recorded history. */
function weeklyEloDelta(player: Player, weekStartKey: string): number {
  const history = [...(player.eloHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
  const before = history.filter((h) => h.date.slice(0, 10) < weekStartKey);
  const inWeek = history.filter((h) => h.date.slice(0, 10) >= weekStartKey);
  if (inWeek.length === 0) return 0;
  const baseline = before.length > 0 ? before[before.length - 1].elo : null;
  if (baseline === null) return 0;
  return player.eloTotal - baseline;
}

function peakElo(player: Player): number {
  return (player.eloHistory || []).reduce((max, h) => Math.max(max, h.elo), player.eloTotal);
}

export function RankingView() {
  const { players, matches, tournaments, currentUser } = useStore();
  const { location, selectTab } = useAppNavigation();
  const activeFilter = location.ranking;
  const [showRulesModal, setShowRulesModal] = useState(false);

  const weekStartKey = getWeekStartKey();
  const monthStartKey = getMonthStartKey();
  const weeklyStats = useMemo(() => computePeriodStats(matches, weekStartKey), [matches, weekStartKey]);
  const monthlyStats = useMemo(() => computePeriodStats(matches, monthStartKey), [matches, monthStartKey]);
  const tournamentWins = useMemo(() => computeTournamentWins(tournaments), [tournaments]);
  const crawlers = weeklyCrawlers(matches);

  useEffect(() => {
    if (!showRulesModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowRulesModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRulesModal]);

  const qualified = players.filter(isQualified);
  const newPlayers = players.filter((p) => !isQualified(p));

  const statFor = (player: Player): { value: number; unit: string } => {
    switch (activeFilter) {
      case '1v1':
        return { value: player.elo1v1, unit: 'ELO' };
      case 'krabbler':
        return { value: crawlers.find((entry) => entry.playerId === player.id)?.losses || 0, unit: '× zu null' };
      case '2v2':
        return { value: player.elo2v2, unit: 'ELO' };
      case 'level':
        return { value: player.level, unit: 'Lvl' };
      case 'wochen':
        return { value: weeklyStats.get(player.id)?.points || 0, unit: 'Pkt' };
      case 'monat':
        return { value: monthlyStats.get(player.id)?.points || 0, unit: 'Pkt' };
      case 'aktiv':
        return { value: monthlyStats.get(player.id)?.games || 0, unit: 'Spiele' };
      case 'turnier':
        return { value: tournamentWins.get(player.id) || 0, unit: 'Siege' };
      case 'historie':
        return { value: peakElo(player), unit: 'ELO' };
      default:
        return { value: player.eloTotal, unit: 'ELO' };
    }
  };

  const tieBreak = (a: Player, b: Player): number => {
    switch (activeFilter) {
      case 'level':
        return b.xp - a.xp;
      case 'wochen':
        return (weeklyStats.get(b.id)?.games || 0) - (weeklyStats.get(a.id)?.games || 0) || b.eloTotal - a.eloTotal;
      case 'monat':
        return (monthlyStats.get(b.id)?.games || 0) - (monthlyStats.get(a.id)?.games || 0) || b.eloTotal - a.eloTotal;
      case 'aktiv':
        return (monthlyStats.get(b.id)?.points || 0) - (monthlyStats.get(a.id)?.points || 0) || b.eloTotal - a.eloTotal;
      default:
        return b.eloTotal - a.eloTotal;
    }
  };

  const periodFilter = (player: Player): boolean => {
    switch (activeFilter) {
      case 'wochen':
        return (weeklyStats.get(player.id)?.games || 0) > 0;
      case 'monat':
      case 'aktiv':
        return (monthlyStats.get(player.id)?.games || 0) > 0;
      case 'turnier':
        return (tournamentWins.get(player.id) || 0) > 0;
      default:
        return true;
    }
  };

  const sortedPlayers = activeFilter === 'krabbler'
    ? crawlers.flatMap((entry) => {
      const player = players.find((p) => p.id === entry.playerId);
      return player ? [player] : [];
    })
    : qualified
    .filter(periodFilter)
    .sort((a, b) => statFor(b).value - statFor(a).value || tieBreak(a, b));

  const emptyMessage =
    activeFilter === 'krabbler'
      ? 'Noch niemand musste diese Woche krabbeln.'
      : qualified.length === 0
      ? `Noch niemand ist qualifiziert. In die Rangliste kommst du ab ${MIN_RANKED_GAMES} gewerteten Spielen.`
      : activeFilter === 'wochen'
      ? 'Diese Woche wurden noch keine gewerteten Spiele von qualifizierten Spielern eingetragen.'
      : activeFilter === 'monat' || activeFilter === 'aktiv'
      ? 'In diesem Monat gibt es noch keine gewerteten Spiele von qualifizierten Spielern.'
      : activeFilter === 'turnier'
      ? 'Noch kein qualifizierter Spieler hat ein Turnier gewonnen.'
      : 'Keine Einträge.';

  return (
    <div className="space-y-5">
      <div className="text-center pt-2">
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Kicker-Rangliste</h2>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-emerald-300/80">
          <span>Jetzt wird gekickert!</span>
          <span aria-hidden>•</span>
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="min-h-[44px] px-1 text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center"
          >
            Regeln & Wertung <ChevronRight className="w-3 h-3 inline" />
          </button>
        </div>
      </div>

      <div
        className="overflow-x-auto no-scrollbar flex items-center justify-start sm:justify-center gap-2 px-1 -mx-1"
        role="group"
        aria-label="Rangliste filtern"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab('ranking', tab.id)}
            aria-pressed={activeFilter === tab.id}
            className={`min-h-[44px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all shadow-sm ${
              activeFilter === tab.id
                ? 'bg-amber-400 text-stone-950 font-black shadow-amber-500/30'
                : 'bg-emerald-950/60 border border-emerald-800/40 text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {FILTER_HINTS[activeFilter] && (
        <p className="text-center text-[11px] text-emerald-300/70 -mt-2">{FILTER_HINTS[activeFilter]}</p>
      )}

      <div className="wood-panel p-2 sm:p-3">
        <div className="bg-[#0b2115] rounded-xl border border-emerald-700/40 p-1.5 sm:p-3 space-y-1">
          {sortedPlayers.length === 0 && (
            <div className="p-6 text-center text-xs text-emerald-300/70">{emptyMessage}</div>
          )}
          {sortedPlayers.map((player, idx) => {
            const rank = idx + 1;
            const isMe = player.id === currentUser?.id;
            const { value, unit } = statFor(player);
            const delta = activeFilter === 'elo' ? weeklyEloDelta(player, weekStartKey) : 0;

            let medalBg = 'bg-stone-800 text-stone-300 border-stone-600';
            if (rank === 1) medalBg = 'bg-gradient-to-b from-amber-300 to-amber-600 text-stone-950 border-amber-300';
            else if (rank === 2) medalBg = 'bg-gradient-to-b from-blue-300 to-blue-600 text-white border-blue-400';
            else if (rank === 3) medalBg = 'bg-gradient-to-b from-orange-400 to-orange-700 text-white border-orange-400';
            else if (rank <= 5) medalBg = 'bg-gradient-to-b from-emerald-600 to-emerald-900 text-white border-emerald-500';

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl transition-all ${
                  isMe
                    ? 'bg-emerald-900/40 border border-emerald-500/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                    : 'hover:bg-emerald-950/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black border-2 shadow-md ${medalBg}`}
                  >
                    {rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-sm tracking-wide truncate max-w-[9rem] sm:max-w-none">
                        <PlayerLink id={player.id}>{player.name}</PlayerLink>
                      </span>
                      <span className="px-1.5 rounded-full bg-emerald-950 border border-emerald-700/60 text-[10px] text-emerald-300 font-bold">
                        {player.level}
                      </span>
                      {rank === 1 && <span className="text-sm" aria-label="Platz 1">👑</span>}
                      {player.currentStreak >= 3 && (
                        <span className="text-xs text-amber-400 font-bold">🔥 {player.currentStreak}</span>
                      )}
                      {isMe && (
                        <span className="text-[10px] px-1.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Du</span>
                      )}
                    </div>
                    <div className="text-[11px] text-emerald-400/60 font-medium truncate">
                      {player.isExternal ? <ExternalLabel /> : `Uni-Jg. ${player.yearJoined}`} • {player.leaguePoints} Ligapunkte
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-2 shrink-0">
                  {delta !== 0 && (
                    <div
                      className={`text-xs font-bold ${delta > 0 ? 'text-neon-lime' : 'text-red-400'}`}
                      title="ELO-Veränderung seit Wochenbeginn"
                    >
                      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                    </div>
                  )}
                  <div className="font-mono text-base font-black text-white tracking-tight">
                    <span>{value}</span>
                    <span className="text-[9px] text-emerald-400/60 ml-0.5">{unit}</span>
                    {activeFilter === 'krabbler' && <div className="text-[10px] text-amber-300">Höchste Niederlage: 0:{crawlers.find((entry) => entry.playerId === player.id)?.worstScore}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {newPlayers.length > 0 && activeFilter !== 'krabbler' && (
        <div className="felt-card p-4">
          <div className="text-center mb-3">
            <h3 className="font-display text-base font-bold text-white">Neu dabei</h3>
            <p className="text-[11px] text-emerald-400/80">In der Rangliste ab {MIN_RANKED_GAMES} gewerteten Spielen</p>
          </div>

          <div className="divide-y divide-emerald-900/30">
            {newPlayers.map((np) => {
              const remaining = Math.max(1, MIN_RANKED_GAMES - gamesPlayed(np));
              return (
                <div key={np.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-950 border-2 border-emerald-700 flex items-center justify-center text-base shadow">
                      {np.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs truncate"><PlayerLink id={np.id}>{np.name}</PlayerLink></span>
                        <span className="px-1.5 rounded-full bg-emerald-950 border border-emerald-700/60 text-[10px] text-emerald-300 font-bold">
                          {np.level}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400/60">{np.isExternal ? <ExternalLabel /> : `Uni-Jg. ${np.yearJoined}`}</div>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-300/80 font-medium shrink-0">
                    noch {remaining} {remaining === 1 ? 'Spiel' : 'Spiele'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showRulesModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-title"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="modal-panel felt-card max-w-md p-4 sm:p-5 space-y-4 border border-emerald-500/50 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-emerald-800/40 pb-2">
              <h3 id="rules-title" className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400" />
                Ligaregeln & Wertung
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                aria-label="Schließen"
                className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-emerald-200/90 leading-relaxed">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">1. Spielablauf & Tore</h4>
                <p>
                  Gespielt wird klassisch bis <strong>10 Tore</strong> (oder nach Absprache). Pro Seite sind höchstens 10 Tore
                  eintragbar, ein Unentschieden gibt es nicht.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">2. ELO-Bewertung</h4>
                <p>
                  Bei einem Sieg gegen stärkere Gegner gibt es deutlich mehr Punkte. Einzel- und Doppelspiele fließen in getrennte
                  ELO-Werte ein.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">3. Ligapunkte & Qualifikation</h4>
                <p>
                  Das Siegerteam erhält <strong>3 Ligapunkte</strong>, eine Niederlage bringt 0 Punkte. In der Rangliste erscheinst
                  du ab <strong>{MIN_RANKED_GAMES} gewerteten Spielen</strong>. Annullierte Spiele zählen nicht.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                <h4 className="font-bold text-amber-400 text-sm mb-1">4. Ergebnis melden & widersprechen</h4>
                <p>
                  Ein eingetragenes Ergebnis ist sofort wirksam. Die Gegenseite kann es als gesehen markieren oder widersprechen. Bei
                  einem Widerspruch wird das Spiel gemeinsam oder durch die Administration geklärt. Eine Streichung braucht die
                  Zustimmung beider Seiten.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
