'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Check, X, AlertTriangle, Clock, Swords, RefreshCw, Trash2, ArrowRight } from 'lucide-react';

interface ConfirmationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfirmationDrawer({ isOpen, onClose }: ConfirmationDrawerProps) {
  const {
    currentUser, 
    matches, 
    players, 
    acknowledgeMatch,
    disputeMatch,
    proposeDisputeResolution,
    acceptDisputeResolution,
    cancelMatchByMutualAgreement 
  } = useStore();

  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [proposedScoreA, setProposedScoreA] = useState<number>(10);
  const [proposedScoreB, setProposedScoreB] = useState<number>(8);

  const [counterId, setCounterId] = useState<string | null>(null);
  const [counterScoreA, setCounterScoreA] = useState<number>(10);
  const [counterScoreB, setCounterScoreB] = useState<number>(8);

  if (!isOpen || !currentUser) return null;

  // Effective matches that have not yet been acknowledged by the logged in user
  const pendingForMe = matches.filter(
    (m) =>
      !['disputed', 'cancelled'].includes(m.status) &&
      (m.teamA.includes(currentUser.id) || m.teamB.includes(currentUser.id)) &&
      !m.confirmedBy.includes(currentUser.id)
  );

  // Disputed matches involving current user that need direct peer resolution
  const disputedForMe = matches.filter(
    (m) =>
      m.status === 'disputed' &&
      (m.teamA.includes(currentUser.id) || m.teamB.includes(currentUser.id))
  );

  const handleDisputeSubmit = (matchId: string) => {
    if (!disputeReason.trim()) return;
    disputeMatch(matchId, disputeReason, proposedScoreA, proposedScoreB);
    setDisputeId(null);
    setDisputeReason('');
  };

  const handleSendCounter = (matchId: string) => {
    proposeDisputeResolution(matchId, counterScoreA, counterScoreB, 'Gegenvorschlag der Gegenseite');
    setCounterId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="felt-card max-w-lg w-full p-5 space-y-5 border border-emerald-500/50 shadow-2xl relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-emerald-400 hover:text-white p-1 rounded-lg bg-emerald-950/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
            Neu für dich
          </h3>
          <p className="text-xs text-emerald-300/80 mt-0.5">
            Neue Ergebnisse ansehen oder strittige Spiele direkt untereinander klären
          </p>
        </div>

        {/* 1. OFFENE BESTÄTIGUNGEN */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5 border-b border-emerald-900/40 pb-1">
            <Clock className="w-3.5 h-3.5" />
            Neue Spielergebnisse ({pendingForMe.length})
          </div>

          {pendingForMe.length === 0 ? (
            <div className="py-3 text-center text-emerald-400/60 text-xs">
              Keine neuen Spielergebnisse vorhanden.
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
                  <div key={m.id} className="py-3 space-y-2">
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

                      {/* Notification acknowledgement; the result is already effective. */}
                      <button
                        onClick={() => acknowledgeMatch(m.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Gesehen
                      </button>
                    </div>

                    {/* "Stimmt nicht?" Link */}
                    {!isDisputingThis ? (
                      <button
                        onClick={() => {
                          setDisputeId(m.id);
                          setProposedScoreA(m.scoreA);
                          setProposedScoreB(m.scoreB);
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-1"
                      >
                        Widersprechen / Ergebnis korrigieren
                      </button>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-3 mt-2">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Ergebnis beanstanden & Gegenvorschlag senden:
                        </div>

                        {/* Counter score inputs */}
                        <div className="flex items-center justify-center gap-3 bg-stone-900/80 p-2 rounded-lg border border-amber-900/60">
                          <div className="text-center">
                            <span className="text-[9px] text-emerald-400 block mb-0.5">
                              {players.find((p) => p.id === m.teamA[0])?.name || 'Team A'}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={proposedScoreA}
                              onChange={(e) => setProposedScoreA(parseInt(e.target.value) || 0)}
                              className="w-12 h-8 text-center text-sm font-bold bg-stone-950 border border-emerald-600 rounded text-amber-400 focus:outline-none"
                            />
                          </div>

                          <span className="text-sm font-bold text-white">:</span>

                          <div className="text-center">
                            <span className="text-[9px] text-emerald-400 block mb-0.5">
                              {players.find((p) => p.id === m.teamB[0])?.name || 'Team B'}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={proposedScoreB}
                              onChange={(e) => setProposedScoreB(parseInt(e.target.value) || 0)}
                              className="w-12 h-8 text-center text-sm font-bold bg-stone-950 border border-emerald-600 rounded text-amber-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="Begründung (z.B. Eigentlich ging das Spiel 10:8 aus)"
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
                            onClick={() => handleDisputeSubmit(m.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg shadow"
                          >
                            Gegenvorschlag an Gegenseite senden
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. STRITTIGE SPIELE DIREKT UNTEREINANDER KLÄREN */}
        {disputedForMe.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 border-b border-red-900/40 pb-1">
              <Swords className="w-3.5 h-3.5" />
              Strittige Spiele zur Einigung ({disputedForMe.length})
            </div>

            <div className="space-y-3">
              {disputedForMe.map((m) => {
                const teamANames = m.teamA.map((id) => players.find((p) => p.id === id)?.name).join(' & ');
                const teamBNames = m.teamB.map((id) => players.find((p) => p.id === id)?.name).join(' & ');
                const proposer = players.find((p) => p.id === m.disputeProposedBy);
                const isProposerMe = m.disputeProposedBy === currentUser.id;

                const hasProposedScore =
                  m.disputeProposedScoreA !== undefined && m.disputeProposedScoreB !== undefined;

                const isCountering = counterId === m.id;

                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-red-950/20 border border-red-600/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{teamANames} vs {teamBNames}</span>
                      <span className="text-[10px] text-red-400 font-semibold uppercase">
                        Strittig ({m.date})
                      </span>
                    </div>

                    <div className="text-xs text-stone-300">
                      <strong>Ursprünglich eingetragen:</strong> {m.scoreA} : {m.scoreB}
                      {m.disputeReason && (
                        <div className="mt-1 text-[11px] text-amber-300/90 italic">
                          &quot;{m.disputeReason}&quot;
                        </div>
                      )}
                    </div>

                    {/* Proposed Score Box */}
                    {hasProposedScore && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/40 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-amber-400 font-bold uppercase">
                            {isProposerMe ? 'Dein Gegenvorschlag:' : `Gegenvorschlag von ${proposer?.name || 'Gegner'}:`}
                          </div>
                          <div className="font-mono text-base font-black text-white mt-0.5">
                            {m.disputeProposedScoreA} : {m.disputeProposedScoreB}
                          </div>
                        </div>

                        {!isProposerMe ? (
                          <button
                            onClick={() => acceptDisputeResolution(m.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            Gegenvorschlag annehmen & werten
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-300/70 italic">
                            Warten auf Annahme durch Gegenseite
                          </span>
                        )}
                      </div>
                    )}

                    {/* Counter or Cancel options */}
                    {!isCountering ? (
                      <div className="flex items-center justify-between pt-1 border-t border-red-900/30 text-xs">
                        <button
                          onClick={() => {
                            setCounterId(m.id);
                            setCounterScoreA(m.disputeProposedScoreA || m.scoreA);
                            setCounterScoreB(m.disputeProposedScoreB || m.scoreB);
                          }}
                          className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Anderen Score vorschlagen
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('Soll dieses Spiel im gegenseitigen Einvernehmen gelöscht/annulliert werden?')) {
                              cancelMatchByMutualAgreement(m.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Spiel streichen
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-stone-900 border border-emerald-600/50 space-y-2 mt-2">
                        <div className="text-xs font-bold text-emerald-300">
                          Dein Gegenvorschlag für {teamANames} vs {teamBNames}:
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={counterScoreA}
                            onChange={(e) => setCounterScoreA(parseInt(e.target.value) || 0)}
                            className="w-12 h-8 text-center text-sm font-bold bg-stone-950 border border-emerald-600 rounded text-amber-400 focus:outline-none"
                          />
                          <span className="font-bold text-white">:</span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={counterScoreB}
                            onChange={(e) => setCounterScoreB(parseInt(e.target.value) || 0)}
                            className="w-12 h-8 text-center text-sm font-bold bg-stone-950 border border-emerald-600 rounded text-amber-400 focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setCounterId(null)}
                            className="px-2.5 py-1 text-xs text-stone-300"
                          >
                            Abbrechen
                          </button>
                          <button
                            onClick={() => handleSendCounter(m.id)}
                            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded"
                          >
                            Vorschlag aktualisieren
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
