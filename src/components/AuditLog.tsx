'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { PlayerLink, useAppNavigation } from './AppNavigation';
import type { AuditEntry } from '@/types/audit';

const labels: Record<AuditEntry['action'],string> = {
  score_corrected: 'Ergebnis korrigiert', match_cancelled: 'Spiel annulliert', player_deleted: 'Spieler gelöscht',
};
export function AuditLog() {
  const {auditEntries, isConnected} = useStore();
  const {openMatch} = useAppNavigation();
  return <section className="felt-card p-4 sm:p-5 space-y-3">
    <h3 className="font-display text-lg font-bold text-white">Änderungsprotokoll</h3>
    <p className="text-xs text-emerald-300/80">
      Die letzten 100 Änderungen seit Einführung des Protokolls. {isConnected ? 'Serverseitig aufgezeichnet.' : 'Lokales Demoprotokoll.'}
    </p>
    {!auditEntries.length && <p className="text-xs text-emerald-300/60">Noch keine Änderungen protokolliert.</p>}
    <div className="max-h-80 overflow-y-auto overscroll-contain space-y-2">
      {auditEntries.map((entry) => <div key={entry.id} className="p-3 rounded-lg bg-emerald-950/60 text-xs space-y-1">
        <div className="flex flex-wrap justify-between gap-2">
          <strong className="text-amber-300">{labels[entry.action]}</strong>
          <time dateTime={entry.createdAt} className="text-emerald-300/70">{new Date(entry.createdAt).toLocaleString('de-DE')}</time>
        </div>
        <div className="text-white">Von: {entry.actorId ? <PlayerLink id={entry.actorId}>{entry.actorName}</PlayerLink> : entry.actorName}</div>
        {entry.action === 'score_corrected' && <p className="font-mono text-emerald-200">
          {String(entry.before.score_a)} : {String(entry.before.score_b)} → {String(entry.after.score_a)} : {String(entry.after.score_b)}
        </p>}
        {entry.action !== 'player_deleted' ? <button type="button" onClick={() => openMatch(entry.targetId)}
          className="min-h-[44px] text-amber-300 underline">Spiel ansehen</button>
          : <p className="text-emerald-300/70 break-all">Profil-ID: {entry.targetId}</p>}
      </div>)}
    </div>
  </section>;
}
