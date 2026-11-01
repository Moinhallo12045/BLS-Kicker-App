'use client';

import React, { useState } from 'react';
import { 
  Trophy, 
  Flame, 
  TrendingUp, 
  ChevronRight, 
  PlusCircle, 
  CheckCircle2, 
  Star, 
  Swords, 
  Award,
  Calendar,
  Sparkles
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { getTierForLevel } from '@/lib/levels';
import { ALL_BADGES } from '@/lib/badges';

interface DashboardViewProps {
  onOpenMatchEntry: () => void;
  onNavigateToTab: (tab: any) => void;
}

export function DashboardView({ onOpenMatchEntry, onNavigateToTab }: DashboardViewProps) {
  const { currentUser, players, matches, tournaments, quests } = useStore();
  const [eloRange, setEloRange] = useState<'1w' | '1m' | 'all'>('all');

  if (!currentUser) return null;

  // Calculate user rank
  const sortedByElo = [...players].sort((a, b) => b.eloTotal - a.eloTotal);
  const myRank = sortedByElo.findIndex((p) => p.id === currentUser.id) + 1;
  const tier = getTierForLevel(currentUser.level);

  // Top 5 players
  const top5 = sortedByElo.slice(0, 5);

  // Recent 3 matches
  const recentMatches = matches.slice(0, 3);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const dayOfWeek = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - dayOfWeek + 1);
  const weekStartKey = weekStart.toISOString().split('T')[0];
  const weeklyCrawlerMatches = matches
    .filter((match) => match.status === 'confirmed' && match.date >= weekStartKey)
    .flatMap((match) => {
      if (match.scoreA === 0 && match.scoreB > 0) {
        return [{ match, playerIds: match.teamA, winningScore: match.scoreB }];
      }
      if (match.scoreB === 0 && match.scoreA > 0) {
        return [{ match, playerIds: match.teamB, winningScore: match.scoreA }];
      }
      return [];
    })
    .sort((a, b) => b.winningScore - a.winningScore);
  const weeklyCrawlers = Array.from(
    weeklyCrawlerMatches.reduce((entries, { playerIds, winningScore }) => {
      playerIds.forEach((playerId) => {
        const entry = entries.get(playerId) || { losses: 0, worstScore: 0 };
        entries.set(playerId, {
          losses: entry.losses + 1,
          worstScore: Math.max(entry.worstScore, winningScore),
        });
      });
      return entries;
    }, new Map<string, { losses: number; worstScore: number }>())
  )
    .map(([playerId, stats]) => ({ playerId, ...stats }))
    .sort((a, b) => b.losses - a.losses || b.worstScore - a.worstScore);

  // XP Progress Percentage
  const xpPercent = Math.min(100, Math.round((currentUser.xp / currentUser.xpNextLevel) * 100));

  return (
    <div className="space-y-6 pb-24">
      {/* Hero Player Card (Matching screenshot 5 & 2) */}
      <div className="wood-panel p-5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Avatar with Level Badge */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1b432e] to-[#0d2217] border-2 border-emerald-500/60 shadow-lg flex items-center justify-center text-3xl">
                {currentUser.avatar}
              </div>
              <div 
                className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border border-stone-900 shadow"
                style={{ backgroundColor: tier.color, color: '#09150f' }}
              >
                Lvl {currentUser.level}
              </div>
            </div>

            <div>
              <div className="text-xs text-emerald-300 font-semibold tracking-wide uppercase">
                Willkommen zurück,
              </div>
              <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                {currentUser.name}
                {currentUser.currentStreak >= 3 && (
                  <span className="text-sm px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-sans">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    {currentUser.currentStreak}
                  </span>
                )}
              </h2>
              <div className="text-xs text-amber-200/80 font-medium">
                {tier.tier} • Uni-Jahrgang {currentUser.yearJoined}
              </div>
            </div>
          </div>

          {/* Quick Rank Badge */}
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">
              Rang
            </div>
            <div className="font-display text-3xl font-extrabold text-amber-400 flex items-center justify-end gap-1">
              <span className="text-lg text-amber-500/80">#</span>
              {myRank}
            </div>
            <div className="text-[11px] text-emerald-300/80">
              von {players.length} Spielern
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-4 pt-3 border-t border-[#7e4b27]/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-emerald-200/90 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Level {currentUser.level} Fortschritt
            </span>
            <span className="text-amber-300 font-bold">
              {currentUser.xp} / {currentUser.xpNextLevel} XP
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
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-[#0e271a]/80 border border-emerald-700/30 p-2.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80">ELO Total</div>
            <div className="text-xl font-black text-white">{currentUser.eloTotal}</div>
            <div className="text-[10px] text-emerald-400/70">1v1: {currentUser.elo1v1}</div>
          </div>
          <div className="rounded-xl bg-[#0e271a]/80 border border-emerald-700/30 p-2.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80">Ligapunkte</div>
            <div className="text-xl font-black text-amber-400">{currentUser.leaguePoints}</div>
            <div className="text-[10px] text-amber-400/70">3 Pkt / Sieg</div>
          </div>
          <div className="rounded-xl bg-[#0e271a]/80 border border-emerald-700/30 p-2.5">
            <div className="text-[10px] uppercase font-bold text-emerald-400/80">Bilanz</div>
            <div className="text-xl font-black text-white">
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
          onClick={onOpenMatchEntry}
          className="mt-4 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-[0_4px_16px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
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

        <div className="space-y-2.5">
          {quests.map((q) => (
            <div
              key={q.id}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                q.completed
                  ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'
                  : 'bg-emerald-950/20 border-emerald-900/30 text-stone-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    q.completed
                      ? 'bg-amber-500 text-stone-950 font-black'
                      : 'border border-emerald-600/50 text-emerald-400'
                  }`}
                >
                  {q.id === 'q4' ? <Star className="w-3.5 h-3.5 fill-current" /> : '✓'}
                </div>
                <span className={`text-xs font-medium ${q.completed ? 'line-through text-emerald-300/80' : ''}`}>
                  {q.title}
                </span>
              </div>
              <span className="text-xs font-bold text-amber-400 font-display">
                +{q.rewardXp} XP
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="felt-card p-4 border border-amber-700/40 bg-amber-950/20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg font-bold text-amber-300 flex items-center gap-2">
            🦀 Krabbler der Woche
          </h3>
          <span className="text-[11px] text-amber-400/80 font-medium">Rangliste</span>
        </div>
        {weeklyCrawlers.length === 0 ? (
          <p className="text-xs text-stone-400">Noch niemand musste diese Woche krabbeln.</p>
        ) : (
          <div className="space-y-1.5">
            {weeklyCrawlers.map(({ playerId, losses, worstScore }, index) => (
              <div key={playerId} className="flex items-center justify-between rounded-lg bg-amber-950/30 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs font-black text-amber-400">#{index + 1}</span>
                  <span className="text-xs font-bold text-white">
                    {players.find((player) => player.id === playerId)?.name || 'Unbekannt'}
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
            onClick={() => onNavigateToTab('profile')}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Elo-Verlauf
          </h3>
          <div className="flex items-center bg-[#07160f] p-1 rounded-full border border-emerald-900/60">
            {(['1w', '1m', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setEloRange(r)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                  eloRange === r
                    ? 'bg-amber-400 text-stone-950 font-bold'
                    : 'text-emerald-300/70 hover:text-white'
                }`}
              >
                {r === '1w' ? '1 Woche' : r === '1m' ? '1 Monat' : 'Alles'}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Visualizer */}
        <div className="h-32 w-full flex flex-col justify-end relative pt-4">
          <div className="absolute top-2 left-0 text-[10px] text-emerald-400/60 font-mono">
            Max: {Math.max(...currentUser.eloHistory.map((h) => h.elo), currentUser.eloTotal)}
          </div>
          <div className="absolute bottom-6 left-0 text-[10px] text-emerald-400/60 font-mono">
            Min: {Math.min(...currentUser.eloHistory.map((h) => h.elo), 1400)}
          </div>

          {/* SVG Line Chart */}
          <div className="w-full h-20 relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80">
              <defs>
                <linearGradient id="eloGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                fill="url(#eloGlow)"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,65 60,60 130,45 200,50 250,20 300,28"
              />
              {/* Highlight points */}
              <circle cx="250" cy="20" r="4" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
              <circle cx="300" cy="28" r="4.5" fill="#22c55e" stroke="#064e3b" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex justify-between text-[10px] text-emerald-400/60 pt-2 border-t border-emerald-900/40">
            <span>Vor 2 Wochen</span>
            <span>Letzte Woche</span>
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
            onClick={() => onNavigateToTab('ranking')}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
          >
            Alle anzeigen
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

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
                    {p.name}
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
            onClick={() => onNavigateToTab('tournaments')}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
          >
            Übersicht
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {tournaments.slice(0, 2).map((t) => (
            <div
              key={t.id}
              onClick={() => onNavigateToTab('tournaments')}
              className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 hover:border-emerald-600/50 cursor-pointer transition-all flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{t.name}</span>
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
              <ChevronRight className="w-4 h-4 text-emerald-400/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
