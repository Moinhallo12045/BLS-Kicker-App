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
import { AuthLandingView } from '@/components/AuthLandingView';
import { useStore } from '@/lib/store';

export default function Home() {
  const { currentUser } = useStore();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isMatchEntryOpen, setIsMatchEntryOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // If not logged in, the landing page is the Login / Invite Registration screen
  if (!currentUser) {
    return <AuthLandingView />;
  }

  // Once logged in, show the full League Dashboard & views
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
        {currentTab === 'admin' && currentUser && ['owner', 'co_owner', 'admin'].includes(currentUser.role) && <AdminView />}
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
    </main>
  );
}
