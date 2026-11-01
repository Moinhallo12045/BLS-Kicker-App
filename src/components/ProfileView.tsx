'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { ALL_BADGES } from '@/lib/badges';
import { getTierForLevel } from '@/lib/levels';
import { Award, Flame, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { MAX_LEVEL, MIN_RANKED_GAMES, formatBestRank, gamesPlayed, getLeagueRank, runAction } from '@/lib/matchViews';

export function ProfileView() {
  const { currentUser, players, resetToDefaultData, logout } = useStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  if (!currentUser) return null;

  const rank = getLeagueRank(players, currentUser.id);
  const isMaxLevel = currentUser.level >= MAX_LEVEL;
  const xpPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((currentUser.xp / Math.max(1, currentUser.xpNextLevel)) * 100)));

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    const result = await runAction(logout, { fallbackError: 'Abmelden fehlgeschlagen.', voidIsSuccess: true });
    if (!result.success) {
      setLogoutError(result.message);
      setLoggingOut(false);
    }
  };
  const tier = getTierForLevel(currentUser.level);
  const roleLabel = {
    owner: 'Owner',
    co_owner: 'Co-Owner',
    admin: 'Admin',
    organiser: 'Organiser',
    player: 'Spieler',
  }[currentUser.role];

  const totalMatches1v1 = currentUser.wins1v1 + currentUser.losses1v1;
  const quote1v1 = totalMatches1v1 > 0 ? Math.round((currentUser.wins1v1 / totalMatches1v1) * 100) : 0;

  const totalMatches2v2 = currentUser.wins2v2 + currentUser.losses2v2;
  const quote2v2 = totalMatches2v2 > 0 ? Math.round((currentUser.wins2v2 / totalMatches2v2) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Profile Header Card */}
      <div className="wood-panel p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          {/* Avatar & Selector */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-[#1b4832] to-[#0c2217] border-2 border-emerald-500/70 flex items-center justify-center text-4xl shadow-xl">
              {currentUser.avatar}
            </div>
            <div
              className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-stone-900 shadow"
              style={{ backgroundColor: tier.color, color: '#09150f' }}
            >
              Lvl {currentUser.level}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-display text-2xl font-bold text-white break-words">
                {currentUser.name}
              </h2>
              {currentUser.role !== 'player' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                  {roleLabel}
                </span>
              )}
            </div>

            <p className="text-xs text-emerald-300/80 mt-0.5">
              {tier.tier} • Uni-Jahrgang {currentUser.yearJoined} • ID: #{currentUser.id.slice(-6)}
            </p>

            <div className="mt-3 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="min-h-[44px] px-3 rounded-lg disabled:opacity-60 bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-xs font-semibold text-red-300 flex items-center gap-1.5 transition-colors"
              >
                {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                {loggingOut ? 'Wird abgemeldet…' : 'Abmelden'}
              </button>
            </div>
            {logoutError && (
              <p role="alert" className="mt-2 text-xs text-red-300 bg-red-950/60 border border-red-700/50 rounded-lg px-2 py-1.5">
                {logoutError}
              </p>
            )}
          </div>

          {/* Rank Badge */}
          <div className="text-center sm:text-right">
            <div className="text-[10px] uppercase font-bold text-emerald-400">Liga-Rang</div>
            {rank ? (
              <div className="font-display text-3xl font-extrabold text-amber-400">#{rank}</div>
            ) : (
              <>
                <div className="font-display text-3xl font-extrabold text-stone-400">–</div>
                <div className="text-[10px] text-emerald-300/80">
                  nicht qualifiziert ({Math.min(gamesPlayed(currentUser), MIN_RANKED_GAMES)}/{MIN_RANKED_GAMES} Spiele)
                </div>
              </>
            )}
            <div className="text-[10px] text-emerald-400/60">
              Beste Platzierung: {formatBestRank(currentUser.bestRank)}
            </div>
          </div>
        </div>

        {/* Level XP Bar */}
        <div className="mt-5 pt-3 border-t border-[#7e4b27]/40">
          <div className="flex justify-between text-xs text-emerald-300 font-semibold mb-1">
            <span>{isMaxLevel ? `Maximallevel ${MAX_LEVEL} erreicht` : `XP bis Level ${currentUser.level + 1}`}</span>
            <span className="text-amber-400 font-mono">
              {isMaxLevel ? 'Max' : `${currentUser.xp} / ${currentUser.xpNextLevel} XP`}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-stone-900 overflow-hidden border border-[#834f2a]/60">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-neon-lime transition-all duration-500"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="felt-card p-3 text-center">
          <div className="text-[10px] uppercase text-emerald-400 font-bold">1v1 Einzel ELO</div>
          <div className="text-xl font-mono font-black text-white mt-1">{currentUser.elo1v1}</div>
          <div className="text-[10px] text-emerald-300/70">
            {currentUser.wins1v1}S / {currentUser.losses1v1}N ({quote1v1}%)
          </div>
        </div>

        <div className="felt-card p-3 text-center">
          <div className="text-[10px] uppercase text-emerald-400 font-bold">2v2 Doppel ELO</div>
          <div className="text-xl font-mono font-black text-white mt-1">{currentUser.elo2v2}</div>
          <div className="text-[10px] text-emerald-300/70">
            {currentUser.wins2v2}S / {currentUser.losses2v2}N ({quote2v2}%)
          </div>
        </div>

        <div className="felt-card p-3 text-center">
          <div className="text-[10px] uppercase text-emerald-400 font-bold">Ligapunkte</div>
          <div className="text-xl font-mono font-black text-amber-400 mt-1">{currentUser.leaguePoints}</div>
          <div className="text-[10px] text-amber-400/70">3 Pkt pro Sieg</div>
        </div>

        <div className="felt-card p-3 text-center">
          <div className="text-[10px] uppercase text-emerald-400 font-bold">Aktuelle Serie</div>
          <div className="text-xl font-mono font-black text-white mt-1 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
            {currentUser.currentStreak}
          </div>
          <div className="text-[10px] text-emerald-300/70">Siege in Serie</div>
        </div>
      </div>

      {/* Badges / Abzeichen Collection */}
      <div className="felt-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Erfolge & Abzeichen ({currentUser.badges.length} von {ALL_BADGES.length})
            </h3>
            <p className="text-xs text-emerald-300/80">
              Schalte Medaillen durch Siege, Serien und Meisterschaften frei
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ALL_BADGES.map((b) => {
            const isUnlocked = currentUser.badges.includes(b.id);
            return (
              <div
                key={b.id}
                className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                  isUnlocked
                    ? 'bg-emerald-950/60 border-emerald-600/60 text-white shadow'
                    : 'bg-emerald-950/20 border-emerald-900/30 opacity-40 grayscale'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[#3b1f0c] border border-amber-500/70 flex items-center justify-center text-2xl mb-2 shadow-inner">
                  {b.icon}
                </div>
                <div className="text-xs font-bold text-amber-300 truncate w-full">
                  {b.title}
                </div>
                <div className="text-[10px] text-emerald-300/70 mt-1 line-clamp-2">
                  {b.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demo reset is only available offline; connected data must never be reset from the client. */}
      {!supabase && (
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={() => {
            if (confirm('Möchtest du alle Spieldaten auf die Standard-Demodaten zurücksetzen?')) {
              resetToDefaultData();
            }
          }}
          className="min-h-[44px] px-3 text-xs text-red-400/60 hover:text-red-400 flex items-center justify-center gap-1.5 mx-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Demodaten zurücksetzen
        </button>
      </div>
      )}
    </div>
  );
}
