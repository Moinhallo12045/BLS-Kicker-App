'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
import { AuthLandingView } from '@/components/AuthLandingView';
import { useStore } from '@/lib/store';
import { isAdminRole, useSyncState } from '@/lib/matchViews';

function SyncErrorBanner() {
  const { syncError, refreshState } = useSyncState();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!syncError) return null;

  const retry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      await refreshState();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Erneuter Versuch fehlgeschlagen.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="relative z-40 pt-safe bg-red-950/95 border-b border-red-700 text-red-100 backdrop-blur"
    >
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-3 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0 text-red-300" />
        <div className="flex-1 min-w-0">
          <div className="font-bold">Synchronisierung fehlgeschlagen</div>
          <div className="text-red-200/90 break-words">{retryError || syncError}</div>
        </div>
        <button
            type="button"
            onClick={retry}
            disabled={isRetrying}
            className="touch-target px-3 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-60 font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Lädt…' : 'Erneut'}
          </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { currentUser } = useStore();
  const { isLoading } = useSyncState();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isMatchEntryOpen, setIsMatchEntryOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  if (!currentUser) {
    return (
      <>
        <SyncErrorBanner />
        <AuthLandingView />
      </>
    );
  }

  const isAdmin = isAdminRole(currentUser.role);
  const activeTab: TabType = currentTab === 'admin' && !isAdmin ? 'dashboard' : currentTab;

  return (
    <main className="min-h-screen flex flex-col">
      <SyncErrorBanner />

      <Navigation
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        onOpenMatchEntry={() => setIsMatchEntryOpen(true)}
        onOpenConfirmations={() => setIsConfirmationOpen(true)}
      />

      {isLoading && (
        <div
          role="status"
          className="max-w-4xl w-full mx-auto px-4 pt-3 text-[11px] text-emerald-300/80 flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Daten werden aktualisiert…
        </div>
      )}

      <div className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-bottom-nav">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenMatchEntry={() => setIsMatchEntryOpen(true)}
            onNavigateToTab={(tab: TabType) => setCurrentTab(tab)}
          />
        )}
        {activeTab === 'ranking' && <RankingView />}
        {activeTab === 'matches' && (
          <MatchesView onOpenMatchEntry={() => setIsMatchEntryOpen(true)} />
        )}
        {activeTab === 'tournaments' && <TournamentView />}
        {activeTab === 'players' && <PlayersView />}
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'admin' && isAdmin && <AdminView />}
      </div>

      <MatchEntryModal
        isOpen={isMatchEntryOpen}
        onClose={() => setIsMatchEntryOpen(false)}
      />

      <ConfirmationDrawer
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
      />

      <LevelUpModal />
    </main>
  );
}
