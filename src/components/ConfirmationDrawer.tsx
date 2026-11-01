'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Check, X, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

interface ConfirmationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfirmationDrawer({ isOpen, onClose }: ConfirmationDrawerProps) {
  const { currentUser, matches, players, confirmMatch, disputeMatch } = useStore();
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  if (!isOpen || !currentUser) return null;

  // Pending matches that require confirmation from the logged in user
  const pendingForMe = matches.filter(
    (m) =>
      m.status === 'pending' &&
      (m.teamA.includes(currentUser.id) || m.teamB.includes(currentUser.id)) &&
      !m.confirmedBy.includes(currentUser.id)
  );

  const handleDispute = (matchId: string) => {
    if (!disputeReason.trim()) return;
    disputeMatch(matchId, disputeReason);
    setDisputeId(null);
    setDisputeReason('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="felt-card max-w-md w-full p-5 space-y-4 border border-emerald-500/50 shadow-2xl relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-emerald-400 hover:text-white p-1 rounded-lg bg-emerald-950/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header (Matching Screenshot 5 "Neu für dich") */}
        <div>
          <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
            Neu für dich
          </h3>
          <p className="text-xs text-emerald-300/80 mt-0.5">
            Bestätige eingetragene Ergebnisse oder melde Unstimmigkeiten
          </p>
        </div>

        {pendingForMe.length === 0 ? (
          <div className="py-8 text-center text-emerald-300/60 text-xs">
            🎉 Keine offenen Spiele zur Bestätigung. Alles auf dem aktuellen Stand!
          </div>
        ) : (
          <div className="divide-y divide-emerald-900/40">
            {pendingForMe.map((m) => {
              const creator = players.find((p) => p.id === m.creatorId);
              const amInTeamA = m.teamA.includes(currentUser.id);
              const myScore = amInTeamA ? m.scoreA : m.scoreB;
              const oppScore = amInTeamA ? m.scoreB : m.scoreA;
              const iWon = myScore > oppScore;

              const isDisputingThis = disputeId === m.id;

              return (
                <div key={m.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-emerald-200">
                        <strong className="text-amber-300 font-semibold">
                          {creator?.name || 'Gegner'}
                        </strong>{' '}
                        hat eingetragen:
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {iWon ? 'Du hast gewonnen' : `${creator?.name || 'Gegner'} hat gewonnen`} ({myScore} : {oppScore})
                      </div>
                      <div className="text-[10px] text-emerald-400/60 mt-0.5">
                        {m.date} • {m.mode}
                      </div>
                    </div>

                    {/* Quick Confirm Button */}
                    <button
                      onClick={() => confirmMatch(m.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Bestätigen
                    </button>
                  </div>

                  {/* "Stimmt nicht?" Link (Directly from Screenshot 5) */}
                  {!isDisputingThis ? (
                    <button
                      onClick={() => setDisputeId(m.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-1"
                    >
                      Stimmt nicht?
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-2 mt-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Ergebnis anfechten:
                      </div>
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Was stimmt nicht? (z.B. falsches Ergebnis, 8:10)"
                        className="w-full bg-stone-900 border border-amber-700/60 rounded-lg p-2 text-xs text-white placeholder-stone-400 focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDisputeId(null)}
                          className="px-2.5 py-1 text-xs text-stone-300 hover:text-white"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={() => handleDispute(m.id)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg"
                        >
                          Als strittig melden
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:text-white text-xs font-bold"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
