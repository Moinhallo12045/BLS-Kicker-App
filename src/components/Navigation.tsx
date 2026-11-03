'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Trophy,
  Plus,
  User,
  Home,
  Swords,
  Crown,
  Users,
  ShieldCheck,
  Sparkles,
  Bell,
  MoreHorizontal,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabaseClient';
import { getActionableMatches, isAdminRole } from '@/lib/matchViews';

import { TabType } from '@/lib/navigation';
export type { TabType } from '@/lib/navigation';

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
  { id: 'features', label: 'Funktionen', icon: Sparkles },
];

export function Navigation({
  currentTab,
  onSelectTab,
  onOpenMatchEntry,
  onOpenConfirmations,
}: NavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    moreRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButton.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target) && !moreButton.current?.contains(event.target)) setMoreOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', outside);
    };
  }, [moreOpen]);
  const { currentUser, matches, players, switchUser } = useStore();

  const actionable = getActionableMatches(matches, currentUser?.id);
  const isAdmin = isAdminRole(currentUser?.role);
  const showDevSwitch = !supabase && players.length > 1;
  const tabs = isAdmin
    ? [...TOP_TABS, { id: 'admin' as TabType, label: 'Verwaltung', icon: ShieldCheck }]
    : TOP_TABS;
  const selectTab = (tab: TabType) => {
    setMoreOpen(false);
    onSelectTab(tab);
  };

  const bottomItem = (tab: TabType, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      type="button"
      onClick={() => selectTab(tab)}
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
              onClick={() => selectTab('dashboard')}
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
                    {players.filter((p) => !p.isSuspended).map((p) => (
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

        </div>
      </header>

      {/* Floating wooden bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pointer-events-none flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {moreOpen && (
          <div ref={moreRef} id="more-navigation" className="pointer-events-auto absolute bottom-full mb-3 w-[calc(100%-1.5rem)] max-w-md felt-card p-2 shadow-2xl">
            <nav aria-label="Weitere Bereiche" className="grid grid-cols-2 gap-2">
              {tabs.filter(({ id }) => ['players', 'tournaments', 'profile', 'features', 'admin'].includes(id)).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-current={currentTab === id ? 'page' : undefined}
                  onClick={() => { setMoreOpen(false); onSelectTab(id); moreButton.current?.focus(); }}
                  className={`min-h-[48px] rounded-xl px-3 flex items-center gap-2 text-sm font-bold ${currentTab === id ? 'bg-emerald-800 text-amber-300' : 'text-emerald-200 hover:bg-emerald-900'}`}>
                  <Icon className="w-5 h-5" />{label}
                </button>
              ))}
            </nav>
          </div>
        )}
        <nav
          aria-label="Hauptnavigation"
          className="pointer-events-auto w-full max-w-md rounded-2xl bg-gradient-to-b from-[#5c351b] via-[#3a200f] to-[#241308] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-[#7e4b27] flex items-center gap-1"
        >
          {bottomItem('dashboard', 'Start', Home)}
          {bottomItem('ranking', 'Rangliste', Trophy)}

          <button
            type="button"
            onClick={() => { setMoreOpen(false); onOpenMatchEntry(); }}
            className="relative -top-2 shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-800 shadow-[0_4px_16px_rgba(34,197,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-[#d97706] flex items-center justify-center text-white active:scale-95 transition-transform"
            aria-label="Spiel eintragen"
          >
            <Plus className="w-8 h-8 stroke-[3]" />
          </button>

          {bottomItem('matches', 'Spiele', Swords)}
          <button ref={moreButton} type="button" aria-expanded={moreOpen} aria-controls="more-navigation"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex-1 min-w-0 min-h-[48px] rounded-xl flex flex-col items-center justify-center ${['players', 'tournaments', 'profile', 'features', 'admin'].includes(currentTab) || moreOpen ? 'bg-emerald-950/80 text-amber-300' : 'text-amber-200/70'}`}>
            <MoreHorizontal className="w-5 h-5 mb-0.5" /><span className="text-[10px] font-bold">Mehr</span>
          </button>
        </nav>
      </div>
    </>
  );
}
