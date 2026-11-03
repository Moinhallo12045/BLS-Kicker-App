'use client';

import React, { useId, useState } from 'react';
import { 
  Trophy, 
  Flame, 
  TrendingUp, 
  ChevronRight, 
  PlusCircle, 
  Star, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { ExternalLabel } from './ExternalLabel';
import { getTierForLevel } from '@/lib/levels';
import { ALL_BADGES } from '@/lib/badges';
import { Player } from '@/types';
import { weeklyCrawlers as computeWeeklyCrawlers } from '@/lib/statistics';
import { PlayerLink, useAppNavigation } from './AppNavigation';
import {
  MAX_LEVEL,
  MIN_RANKED_GAMES,
  daysAgoKey,
  gamesPlayed,
  getLeagueRank,
  getQualifiedByElo,
} from '@/lib/matchViews';

type EloRange = '1w' | '1m' | 'all';

/** Builds chart points from the real ELO history for the selected range. */
function buildEloSeries(player: Player, range: EloRange): { date: string; elo: number }[] {
  const history = [...(player.eloHistory || [])]
    .filter((h) => Number.isFinite(h.elo))
    .sort((a, b) => a.date.localeCompare(b.date));
  let series = history;
  if (range !== 'all') {
    const cutoff = daysAgoKey(range === '1w' ? 6 : 29);
    const before = history.filter((h) => h.date.slice(0, 10) < cutoff);
    const inRange = history.filter((h) => h.date.slice(0, 10) >= cutoff);
    series = before.length > 0 ? [{ date: cutoff, elo: before[before.length - 1].elo }, ...inRange] : inRange;
  }
  const last = series[series.length - 1];
  if (!last || last.elo !== player.eloTotal) {
    series = [...series, { date: new Date().toISOString().slice(0, 10), elo: player.eloTotal }];
  }
  return series;
}

function formatShortDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.` : date;
}

interface DashboardViewProps {
  onOpenMatchEntry: () => void;
  onNavigateToTab: (tab: 'dashboard' | 'ranking' | 'matches' | 'players' | 'tournaments' | 'profile' | 'admin') => void;
}

export function DashboardView({ onOpenMatchEntry, onNavigateToTab }: DashboardViewProps) {
  const { selectTab } = useAppNavigation();
  const { currentUser, players, matches, tournaments, quests } = useStore();
  const [eloRange, setEloRange] = useState<EloRange>('all');
  const gradientId = useId().replace(/:/g, '');

  if (!currentUser) return null;

  const qualified = getQualifiedByElo(players);
  const myRank = getLeagueRank(players, currentUser.id);
  const myGames = gamesPlayed(currentUser);
  const tier = getTierForLevel(currentUser.level);
  const top5 = qualified.slice(0, 5);
  const weeklyCrawlers = computeWeeklyCrawlers(matches);

  // XP Progress Percentage
  const isMaxLevel = currentUser.level >= MAX_LEVEL;
  const xpPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((currentUser.xp / Math.max(1, currentUser.xpNextLevel)) * 100)));

  const eloSeries = buildEloSeries(currentUser, eloRange);
  const eloValues = eloSeries.map((h) => h.elo);
  let eloMin = Math.min(...eloValues);
  let eloMax = Math.max(...eloValues);
  if (eloMin === eloMax) {
    eloMin -= 10;
    eloMax += 10;
  }
  const chartPoints = eloSeries.map((h, i) => {
    const x = eloSeries.length === 1 ? 150 : (i / (eloSeries.length - 1)) * 300;
    const y = 72 - ((h.elo - eloMin) / (eloMax - eloMin)) * 64;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
  const polyline = chartPoints.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const areaPath =
    chartPoints.length > 1
      ? `M0,80 L${chartPoints.map((pt) => `${pt.x},${pt.y}`).join(' L')} L300,80 Z`
      : '';
  const lastPoint = chartPoints[chartPoints.length - 1];
  const realMin = Math.min(...eloValues);
  const realMax = Math.max(...eloValues);
  const upcomingTournaments = tournaments.filter((t) => t.status !== 'completed').slice(0, 2);

  return (
    <div className="space-y-5">
      {/* Hero Player Card (Matching screenshot 5 & 2) */}
      <div className="wood-panel p-4 sm:p-5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with Level Badge */}
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-[#1b432e] to-[#0d2217] border-2 border-emerald-500/60 shadow-lg flex items-center justify-center text-3xl">
                {currentUser.avatar}
              </div>
              <div 
                className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border border-stone-900 shadow"
                style={{ backgroundColor: tier.color, color: '#09150f' }}
              >
                Lvl {currentUser.level}
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-xs text-emerald-300 font-semibold tracking-wide uppercase">
                Willkommen zurück,
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2 min-w-0">
                <span className="truncate">{currentUser.name}</span>
                {currentUser.currentStreak >= 3 && (
                  <span className="text-sm px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-sans">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    {currentUser.currentStreak}
                  </span>
                )}
              </h2>
              <div className="text-xs text-amber-200/80 font-medium">
                {tier.tier} • {currentUser.isExternal ? <ExternalLabel /> : `Uni-Jahrgang ${currentUser.yearJoined}`}
              </div>
            </div>
          </div>

          {/* Quick Rank Badge */}
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">Rang</div>
            {myRank ? (
              <>
                <div className="font-display text-3xl font-extrabold text-amber-400 flex items-center justify-end gap-1">
                  <span className="text-lg text-amber-500/80">#</span>
                  {myRank}
                </div>
                <div className="text-[11px] text-emerald-300/80">von {qualified.length} qualifizierten</div>
              </>
            ) : (
              <>
                <div className="font-display text-3xl font-extrabold text-stone-400">–</div>
                <div className="text-[11px] text-emerald-300/80">
                  nicht qualifiziert ({Math.min(myGames, MIN_RANKED_GAMES)}/{MIN_RANKED_GAMES} Spiele)
                </div>
              </>
            )}
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-4 pt-3 border-t border-[#7e4b27]/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-emerald-200/90 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {isMaxLevel ? `Level ${MAX_LEVEL} – Maximallevel` : `Level ${currentUser.level} Fortschritt`}
            </span>
            <span className="text-amber-300 font-bold">
              {isMaxLevel ? 'Max' : `${currentUser.xp} / ${currentUser.xpNextLevel} XP`}
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-[#170e06] p-0.5 border border-[#834f2a]/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-neon-lime transition-all duration-700 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          <div className="rounded-xl bg-[#0e271a]/80 border border-emerald-700/30 p-2 sm:p-2.5 min-w-0">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80">ELO Total</div>
            <div className="text-lg sm:text-xl font-black text-white">{currentUser.eloTotal}</div>
            <div className="text-[10px] text-emerald-400/70">1v1: {currentUser.elo1v1}</div>
          </div>
          <div className="rounded-xl bg-[#0e271a]/80 border border-emerald-700/30 p-2 sm:p-2.5 min-w-0">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80">Ligapunkte</div>
            <div className="text-lg sm:text-xl font-black text-amber-400">{currentUser.leaguePoints}</div>
            <div className="text-[10px] text-amber-400/70">3 Pkt / Sieg</div>
          </div>
          <div className="rounded-xl bg-[#0e271a]/80 border border-emerald-700/30 p-2 sm:p-2.5 min-w-0">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80">Bilanz</div>
            <div className="text-lg sm:text-xl font-black text-white">
              {currentUser.wins1v1 + currentUser.wins2v2}
              <span className="text-emerald-400 text-sm font-semibold mx-1">:</span>
              {currentUser.losses1v1 + currentUser.losses2v2}
            </div>
            <div className="text-[10px] text-emerald-400/70">
              {Math.round(
                ((currentUser.wins1v1 + currentUser.wins2v2) /
                  Math.max(
                    1,
                    currentUser.wins1v1 +
                      currentUser.wins2v2 +
                      currentUser.losses1v1 +
                      currentUser.losses2v2
                  )) *
                  100
              )}
              % Quote
            </div>
          </div>
        </div>

        {/* Big Match Entry CTA Button */}
        <button
          type="button"
          onClick={onOpenMatchEntry}
          className="mt-4 w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-[0_4px_16px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-5 h-5 text-amber-300" />
          <span>Neues Spiel eintragen</span>
        </button>
      </div>

      {/* Aufgaben der Woche (Directly matches Screenshot 2) */}
      <div className="felt-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            Aufgaben der Woche
          </h3>
          <span className="text-[11px] text-emerald-400/80 font-medium">neu montags</span>
        </div>

        {quests.length === 0 ? (
          <p className="text-xs text-emerald-300/60">Diese Woche gibt es keine Aufgaben.</p>
        ) : (
          <ul className="space-y-2.5">
            {quests.map((q) => {
              const total = Math.max(1, q.total || 1);
              const progress = Math.min(total, Math.max(0, q.progress || 0));
              const percent = Math.round((progress / total) * 100);
              return (
                <li
                  key={q.id}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    q.completed
                      ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                      : 'bg-emerald-950/20 border-emerald-900/30 text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs ${
                          q.completed ? 'bg-amber-500 text-stone-950 font-black' : 'border border-emerald-600/50 text-emerald-400'
                        }`}
                        aria-hidden
                      >
                        {q.completed ? '✓' : <Star className="w-3 h-3" />}
                      </div>
                      <span className="text-xs font-medium">{q.title}</span>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${q.completed ? 'text-neon-lime' : 'text-amber-400'}`}>
                      {q.completed ? 'Geschafft' : `${progress}/${total}`}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 rounded-full bg-[#06140d] overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={progress}
                    aria-label={q.title}
                  >
                    <div
                      className={`h-full rounded-full ${q.completed ? 'bg-neon-lime' : 'bg-amber-400'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="felt-card p-4 border border-amber-700/40 bg-amber-950/20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg font-bold text-amber-300 flex items-center gap-2">
            🦀 Krabbler der Woche
          </h3>
          <button type="button" onClick={() => selectTab('ranking', 'krabbler')} className="min-h-[44px] text-[11px] text-amber-400 font-medium hover:underline">Rangliste</button>
        </div>
        {weeklyCrawlers.length === 0 ? (
          <p className="text-xs text-stone-400">Noch niemand musste diese Woche krabbeln.</p>
        ) : (
          <div className="space-y-1.5">
            {weeklyCrawlers.map(({ playerId, losses, worstScore }, index) => (
              <div key={playerId} className="flex items-center justify-between rounded-lg bg-amber-950/30 px-2.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 text-center text-xs font-black text-amber-400">#{index + 1}</span>
                  <span className="text-xs font-bold text-white">
                    <PlayerLink id={playerId}>{players.find((player) => player.id === playerId)?.name || 'Unbekannt'}</PlayerLink>
                  </span>
                </div>
                <span className="text-right text-xs font-black text-amber-300">
                  {losses}x · 0:{worstScore}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abzeichen Showcase (Directly matches Screenshot 2) */}
      <div className="felt-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold text-white">
            Abzeichen
          </h3>
          <button
            type="button"
            onClick={() => onNavigateToTab('profile')}
            className="min-h-[44px] px-1 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
          >
            {currentUser.badges.length} von {ALL_BADGES.length}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {ALL_BADGES.slice(0, 4).map((b) => {
            const hasBadge = currentUser.badges.includes(b.id);
            return (
              <div
                key={b.id}
                className={`p-2 rounded-xl flex flex-col items-center text-center transition-all ${
                  hasBadge
                    ? 'bg-emerald-950/60 border border-emerald-700/50 text-white'
                    : 'opacity-40 grayscale bg-emerald-950/20 border border-emerald-900/20'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#3a200f] border border-amber-600/60 flex items-center justify-center text-lg mb-1 shadow-inner">
                  {b.icon}
                </div>
                <div className="text-[11px] font-semibold truncate w-full">{b.title}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Elo-Verlauf Interactive Chart (Directly matches Screenshot 2) */}
      <div className="felt-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Elo-Verlauf
          </h3>
          <div className="flex items-center bg-[#07160f] p-0.5 rounded-full border border-emerald-900/60" role="group" aria-label="Zeitraum">
            {(['1w', '1m', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setEloRange(r)}
                aria-pressed={eloRange === r}
                className={`min-h-[44px] px-3 rounded-full text-[11px] font-semibold transition-all ${
                  eloRange === r ? 'bg-amber-400 text-stone-950 font-bold' : 'text-emerald-300/70 hover:text-white'
                }`}
              >
                {r === '1w' ? '1 Woche' : r === '1m' ? '1 Monat' : 'Alles'}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <div className="flex justify-between text-[10px] text-emerald-400/60 font-mono mb-1">
            <span>Max: {realMax}</span>
            <span>Min: {realMin}</span>
          </div>
          <div className="w-full aspect-[300/80] relative">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 300 80"
              preserveAspectRatio="none"
              role="img"
              aria-label={`ELO-Verlauf: ${eloSeries.length} Datenpunkte, aktuell ${currentUser.eloTotal}`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
              {chartPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points={polyline}
                />
              )}
              {lastPoint && (
                <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="#22c55e" stroke="#064e3b" strokeWidth="2" />
              )}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-emerald-400/60 pt-2 mt-1 border-t border-emerald-900/40">
            <span>{eloSeries.length > 1 ? formatShortDate(eloSeries[0].date) : 'Noch kein Verlauf'}</span>
            <span className="text-amber-400 font-semibold">Aktuell ({currentUser.eloTotal})</span>
          </div>
        </div>
      </div>

      {/* Top 5 Rangliste Teaser */}
      <div className="felt-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Top 5 der Liga
          </h3>
          <button
            type="button"
            onClick={() => onNavigateToTab('ranking')}
            className="min-h-[44px] px-1 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
          >
            Alle anzeigen
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {top5.length === 0 && (
          <p className="text-xs text-emerald-300/60">
            Noch niemand hat {MIN_RANKED_GAMES} gewertete Spiele – die Rangliste füllt sich bald.
          </p>
        )}
        <div className="divide-y divide-emerald-900/30">
          {top5.map((p, idx) => (
            <div key={p.id} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0
                      ? 'bg-amber-400 text-stone-950'
                      : idx === 1
                      ? 'bg-slate-300 text-stone-950'
                      : idx === 2
                      ? 'bg-amber-700 text-white'
                      : 'text-emerald-400 font-semibold'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-base">
                  {p.avatar}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <PlayerLink id={p.id}>{p.name}</PlayerLink>
                    {p.id === currentUser.id && (
                      <span className="text-[10px] text-amber-400 font-normal">(Du)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-emerald-400/70">
                    Lvl {p.level} • {p.leaguePoints} Pkt
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-emerald-300">
                  {p.eloTotal}
                </div>
                <div className="text-[10px] text-emerald-400/60">ELO</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kommende Turniere */}
      <div className="felt-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Aktive & Kommende Turniere
          </h3>
          <button
            type="button"
            onClick={() => onNavigateToTab('tournaments')}
            className="min-h-[44px] px-1 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
          >
            Übersicht
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {upcomingTournaments.length === 0 && (
            <p className="text-xs text-emerald-300/60">Aktuell laufen keine Turniere.</p>
          )}
          {upcomingTournaments.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => onNavigateToTab('tournaments')}
              className="w-full text-left min-h-[44px] p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 hover:border-emerald-600/50 transition-all flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-white truncate">{t.name}</span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      t.status === 'running'
                        ? 'bg-emerald-500/20 text-neon-lime border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {t.status === 'running' ? 'Läuft' : 'Anmeldung'}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-400/70 mt-0.5">
                  Modus: {t.type.toUpperCase()} • {t.mode} • {t.participants.length} Teilnehmer
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/60 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
