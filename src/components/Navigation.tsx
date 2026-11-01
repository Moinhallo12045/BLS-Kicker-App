'use client';

import React from 'react';
import { 
  Trophy, 
  Plus, 
  User, 
  Home, 
  Swords, 
  Crown, 
  Users, 
  ShieldCheck, 
  Bell,
  Sparkles
} from 'lucide-react';
import { useStore } from '@/lib/store';

export type TabType = 'dashboard' | 'ranking' | 'matches' | 'tournaments' | 'players' | 'profile' | 'admin';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenMatchEntry: () => void;
  onOpenConfirmations: () => void;
}

export function Navigation({
  currentTab,
  onSelectTab,
  onOpenMatchEntry,
  onOpenConfirmations,
}: NavigationProps) {
  const { currentUser, matches, players, switchUser } = useStore();

  // Pending matches that require confirmation from the current user
  const pendingForMe = matches.filter(
    (m) =>
      m.status === 'pending' &&
      (m.teamA.includes(currentUser?.id || '') || m.teamB.includes(currentUser?.id || '')) &&
      !m.confirmedBy.includes(currentUser?.id || '')
  );

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[#07160f]/90 backdrop-blur-md border-b border-emerald-900/40 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => onSelectTab('dashboard')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 p-0.5 shadow-md flex items-center justify-center">
              <span className="text-lg">⚽</span>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                KICKER LEAGUE
              </h1>
              <div className="text-[10px] text-emerald-400/80 uppercase font-semibold tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                BLS Community Liga
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick user switcher only available in local development mode */}
            {process.env.NODE_ENV === 'development' && players.length > 1 && (
              <div className="hidden sm:flex items-center bg-emerald-950/60 border border-emerald-800/50 rounded-full px-2.5 py-1 text-xs">
                <span className="text-emerald-400/70 mr-1.5 text-[11px]">Angemeldet als (Dev):</span>
                <select
                  value={currentUser?.id || ''}
                  onChange={(e) => switchUser(e.target.value)}
                  className="bg-transparent text-amber-300 font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.name} (Lvl {p.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notification bell for pending matches */}
            <button
              onClick={onOpenConfirmations}
              className="relative p-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 transition-all hover:scale-105"
              title="Neu für dich - Bestätigungen"
            >
              <Bell className="w-5 h-5" />
              {pendingForMe.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-[11px] font-black flex items-center justify-center shadow-lg animate-bounce">
                  {pendingForMe.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Secondary Category Bar for Desktop and Mobile scrolling */}
        <div className="max-w-4xl mx-auto mt-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 pb-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'dashboard'
                ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <button
            onClick={() => onSelectTab('ranking')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'ranking'
                ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Rangliste
          </button>

          <button
            onClick={() => onSelectTab('matches')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'matches'
                ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Spiele
          </button>

          <button
            onClick={() => onSelectTab('tournaments')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'tournaments'
                ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Turniere
          </button>

          <button
            onClick={() => onSelectTab('players')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'players'
                ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Spieler
          </button>

          <button
            onClick={() => onSelectTab('profile')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              currentTab === 'profile'
                ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Mein Profil
          </button>

          {currentUser && ['owner', 'admin'].includes(currentUser.role) && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                currentTab === 'admin'
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-amber-300/80 hover:text-white hover:bg-amber-950/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
        </div>
      </header>

      {/* Floating Wooden Mobile Navigation Bar (Styled directly after the reference screenshots!) */}
      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center">
        <nav 
          aria-label="Hauptnavigation"
          className="pointer-events-auto w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#5c351b] via-[#3a200f] to-[#241308] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-[#7e4b27] flex items-center justify-between"
        >
          {/* Left Button: Leaderboard / Rangliste */}
          <button
            onClick={() => onSelectTab('ranking')}
            className={`flex-1 py-2 rounded-xl flex flex-col items-center justify-center transition-all ${
              currentTab === 'ranking'
                ? 'bg-emerald-950/80 text-amber-300 border border-emerald-700/50 shadow-inner'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Trophy className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">Rangliste</span>
          </button>

          {/* Center Button: Large "+" Action Button */}
          <button
            onClick={onOpenMatchEntry}
            className="relative -top-2 mx-2 w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-800 p-0.5 shadow-[0_4px_16px_rgba(34,197,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-[#d97706] flex items-center justify-center text-white active:scale-95 transition-transform hover:scale-105"
            title="Spiel eintragen"
          >
            <Plus className="w-8 h-8 stroke-[3]" />
          </button>

          {/* Right Button: Profile / Mein Profil */}
          <button
            onClick={() => onSelectTab('profile')}
            className={`flex-1 py-2 rounded-xl flex flex-col items-center justify-center transition-all ${
              currentTab === 'profile'
                ? 'bg-emerald-950/80 text-amber-300 border border-emerald-700/50 shadow-inner'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">Profil</span>
          </button>
        </nav>
      </div>
    </>
  );
}
