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
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabaseClient';
import { getActionableMatches, isAdminRole } from '@/lib/matchViews';

export type TabType = 'dashboard' | 'ranking' | 'matches' | 'tournaments' | 'players' | 'profile' | 'admin';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenMatchEntry: () => void;
  onOpenConfirmations: () => void;
}

const TOP_TABS: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'ranking', label: 'Rangliste', icon: Trophy },
  { id: 'matches', label: 'Spiele', icon: Swords },
  { id: 'tournaments', label: 'Turniere', icon: Crown },
  { id: 'players', label: 'Spieler', icon: Users },
  { id: 'profile', label: 'Mein Profil', icon: User },
];

export function Navigation({
  currentTab,
  onSelectTab,
  onOpenMatchEntry,
  onOpenConfirmations,
}: NavigationProps) {
  const { currentUser, matches, players, switchUser } = useStore();

  const actionable = getActionableMatches(matches, currentUser?.id);
  const isAdmin = isAdminRole(currentUser?.role);
  const showDevSwitch = !supabase && players.length > 1;
  const tabs = isAdmin
    ? [...TOP_TABS, { id: 'admin' as TabType, label: 'Verwaltung', icon: ShieldCheck }]
    : TOP_TABS;

  const bottomItem = (tab: TabType, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      type="button"
      onClick={() => onSelectTab(tab)}
      aria-current={currentTab === tab ? 'page' : undefined}
      className={`flex-1 min-w-0 min-h-[48px] py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
        currentTab === tab
          ? 'bg-emerald-950/80 text-amber-300 border border-emerald-700/50 shadow-inner'
          : 'text-amber-200/70 hover:text-white border border-transparent'
      }`}
    >
      <Icon className="w-5 h-5 mb-0.5" />
      <span className="text-[10px] font-bold truncate max-w-full">{label}</span>
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-30 pt-safe bg-[#07160f]/90 backdrop-blur-md border-b border-emerald-900/40">
        <div className="px-3 sm:px-4 pt-2.5">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2.5 min-h-[44px] min-w-0 group text-left"
            >
              <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 p-0.5 shadow-md flex items-center justify-center">
                <span className="text-lg">⚽</span>
              </div>
              <div className="min-w-0">
                <span className="block font-display text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors truncate">
                  KICKER LEAGUE
                </span>
                <span className="text-[10px] text-emerald-400/80 uppercase font-semibold tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  BLS Community Liga
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {/* Local demo user switcher, never shown when connected to Supabase */}
              {showDevSwitch && (
                <label className="hidden sm:flex items-center bg-emerald-950/60 border border-emerald-800/50 rounded-full px-2.5 min-h-[44px] text-xs">
                  <span className="text-emerald-400/70 mr-1.5 text-[11px]">Demo-Spieler:</span>
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
                </label>
              )}

              <button
                type="button"
                onClick={onOpenConfirmations}
                className="relative w-11 h-11 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 transition-colors flex items-center justify-center"
                aria-label={
                  actionable.total > 0
                    ? `Neu für dich: ${actionable.total} offene Einträge${actionable.disputed.length ? `, davon ${actionable.disputed.length} strittig` : ''}`
                    : 'Neu für dich – keine offenen Einträge'
                }
              >
                <Bell className="w-5 h-5" />
                {actionable.total > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center shadow-lg ${
                      actionable.disputed.length > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-stone-950'
                    }`}
                  >
                    {actionable.total}
                  </span>
                )}
              </button>
            </div>
          </div>

          <nav
            aria-label="Bereiche"
            className="max-w-4xl mx-auto mt-1.5 -mx-3 sm:mx-auto px-3 sm:px-0 overflow-x-auto no-scrollbar flex items-center gap-1.5 pb-2"
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={currentTab === id ? 'page' : undefined}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  currentTab === id
                    ? 'bg-amber-400 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                    : id === 'admin'
                    ? 'text-amber-300/80 hover:text-white hover:bg-amber-950/40'
                    : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Floating wooden bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pointer-events-none flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <nav
          aria-label="Hauptnavigation"
          className="pointer-events-auto w-full max-w-md rounded-2xl bg-gradient-to-b from-[#5c351b] via-[#3a200f] to-[#241308] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-[#7e4b27] flex items-center gap-1"
        >
          {bottomItem('dashboard', 'Start', Home)}
          {bottomItem('ranking', 'Rangliste', Trophy)}

          <button
            type="button"
            onClick={onOpenMatchEntry}
            className="relative -top-2 shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-800 shadow-[0_4px_16px_rgba(34,197,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-[#d97706] flex items-center justify-center text-white active:scale-95 transition-transform"
            aria-label="Spiel eintragen"
          >
            <Plus className="w-8 h-8 stroke-[3]" />
          </button>

          {bottomItem('matches', 'Spiele', Swords)}
          {bottomItem('profile', 'Profil', User)}
        </nav>
      </div>
    </>
  );
}
