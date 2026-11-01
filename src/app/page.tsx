'use client';

import React, { useState } from 'react';
import { Navigation, TabType } from '@/components/Navigation';
import { DashboardView } from '@/components/DashboardView';
import { RankingView } from '@/components/RankingView';
import { MatchesView } from '@/components/MatchesView';
import { TournamentView } from '@/components/TournamentView';
import { PlayersView } from '@/components/PlayersView';
import { ProfileView } from '@/components/ProfileView';
import { AdminView } from '@/components/AdminView';
import { MatchEntryModal } from '@/components/MatchEntryModal';
import { ConfirmationDrawer } from '@/components/ConfirmationDrawer';
import { LevelUpModal } from '@/components/LevelUpModal';
import { useStore } from '@/lib/store';
import { Sparkles, Key, AlertCircle } from 'lucide-react';

export default function Home() {
  const { currentUser, registerWithInvite } = useStore();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isMatchEntryOpen, setIsMatchEntryOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // Registration modal state (for closed community onboarding)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regAvatar, setRegAvatar] = useState('⚽');
  const [regError, setRegError] = useState<string | null>(null);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    const res = registerWithInvite({
      name: regName,
      email: regEmail,
      inviteCode: regCode,
      avatar: regAvatar,
    });
    if (!res.success) {
      setRegError(res.message);
    } else {
      setShowRegisterModal(false);
      setRegName('');
      setRegEmail('');
      setRegCode('');
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Top Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenMatchEntry={() => setIsMatchEntryOpen(true)}
        onOpenConfirmations={() => setIsConfirmationOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6">
        {/* Closed Community Invite Banner */}
        <div className="mb-4 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Geschlossene Liga: Registrierung nur mit Einladungscode.</span>
          </div>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-[11px] underline underline-offset-2"
          >
            <Key className="w-3 h-3" />
            Neuer Spieler beitreten
          </button>
        </div>

        {/* View Switcher */}
        {currentTab === 'dashboard' && (
          <DashboardView
            onOpenMatchEntry={() => setIsMatchEntryOpen(true)}
            onNavigateToTab={(tab: TabType) => setCurrentTab(tab)}
          />
        )}
        {currentTab === 'ranking' && <RankingView />}
        {currentTab === 'matches' && (
          <MatchesView onOpenMatchEntry={() => setIsMatchEntryOpen(true)} />
        )}
        {currentTab === 'tournaments' && <TournamentView />}
        {currentTab === 'players' && <PlayersView />}
        {currentTab === 'profile' && <ProfileView />}
        {currentTab === 'admin' && <AdminView />}
      </div>

      {/* Modals & Dialogs */}
      <MatchEntryModal
        isOpen={isMatchEntryOpen}
        onClose={() => setIsMatchEntryOpen(false)}
      />

      <ConfirmationDrawer
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
      />

      <LevelUpModal />

      {/* Closed Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleRegister}
            className="felt-card max-w-sm w-full p-5 space-y-4 border border-amber-400/50 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                Mit Einladung beitreten
              </h3>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-stone-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  Einladungscode
                </label>
                <input
                  type="text"
                  required
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                  placeholder="z.B. KICKER2026"
                  className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white uppercase font-mono font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  Spielername
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="z.B. Alex K."
                  className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  E-Mail Adresse
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="alex@beispiel.de"
                  className="w-full bg-emerald-950/80 border border-emerald-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  Avatar auswählen
                </label>
                <div className="flex gap-2 justify-center py-1">
                  {['⚽', '🎯', '🦁', '👑', '🔥', '⚡'].map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setRegAvatar(av)}
                      className={`w-9 h-9 rounded-xl border text-lg flex items-center justify-center transition-all ${
                        regAvatar === av
                          ? 'bg-amber-500/20 border-amber-400 scale-110'
                          : 'bg-emerald-950/40 border-emerald-800/40'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {regError && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {regError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow-lg"
            >
              Registrieren & Loslegen
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
