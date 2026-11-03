'use client';

import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useStore } from '@/lib/store';

export function SyncStatus() {
  const {isConnected, isOnline, isRefreshing, lastSyncedAt, refreshState, syncError} = useStore();
  return (
    <div className="max-w-4xl w-full mx-auto px-4 py-2 flex flex-wrap items-center gap-2 text-[11px] text-emerald-300/80">
      <span role="status" className="flex items-center gap-1.5">
        {!isOnline && <WifiOff className="w-3.5 h-3.5" />}
        {!isConnected ? 'Lokaler Demomodus – keine Serversynchronisierung'
          : !isOnline ? 'Offline – angezeigte Daten können veraltet sein'
          : isRefreshing ? 'Daten werden aktualisiert…'
          : syncError ? 'Aktualisierung fehlgeschlagen – letzter Datenstand bleibt sichtbar'
          : lastSyncedAt ? `Zuletzt aktualisiert: ${new Date(lastSyncedAt).toLocaleTimeString('de-DE')}`
          : 'Noch nicht synchronisiert'}
      </span>
      {isConnected && <button type="button" disabled={!isOnline || isRefreshing}
        onClick={() => void refreshState()}
        className="min-h-[44px] px-3 ml-auto rounded-lg bg-emerald-950 text-emerald-200 flex items-center gap-1.5 disabled:opacity-50">
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Aktualisieren
      </button>}
    </div>
  );
}
