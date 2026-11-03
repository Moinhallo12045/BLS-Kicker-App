'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Match } from '@/types';
import {
  ActionResult,
  MAX_SCORE,
  getActionableMatches,
  getCancellationState,
  isAdminRole,
  isOpposingSide,
  parseScore,
  playerNames,
  runAction,
  teamOf,
  validateScore,
} from '@/lib/matchViews';
import { Check, X, AlertTriangle, Clock, Swords, RefreshCw, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppNavigation } from './AppNavigation';

interface ConfirmationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  matchId?: string;
}

type Feedback = { text: string; error: boolean };

const scoreInputClass =
  'w-14 h-11 text-center text-base font-bold bg-stone-950 border border-emerald-600 rounded-lg text-amber-400 focus:outline-none focus:border-amber-400';

export function ConfirmationDrawer({ isOpen, onClose, matchId }: ConfirmationDrawerProps) {
  const { openMatch } = useAppNavigation();
  const {
    currentUser,
    matches,
    players,
    acknowledgeMatch,
    disputeMatch,
    proposeDisputeResolution,
    acceptDisputeResolution,
    cancelMatchByMutualAgreement,
  } = useStore();

  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [proposedScoreA, setProposedScoreA] = useState('');
  const [proposedScoreB, setProposedScoreB] = useState('');

  const [counterId, setCounterId] = useState<string | null>(null);
  const [counterScoreA, setCounterScoreA] = useState('');
  const [counterScoreB, setCounterScoreB] = useState('');

  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const retries = useRef<Record<string, () => Promise<boolean>>>({});

  useEffect(() => {
    if (isOpen) return;
    setDisputeId(null);
    setCounterId(null);
    setDisputeReason('');
    setFeedback({});
    retries.current = {};
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  const isAdmin = isAdminRole(currentUser.role);
  const scopedMatches = matchId ? matches.filter((match) => match.id === matchId) : matches;
  const actionable = getActionableMatches(scopedMatches, currentUser.id);
  const pendingForMe = matchId ? scopedMatches.filter((match) => !match.tournamentId && teamOf(match, currentUser.id) && (match.status === 'pending' || match.status === 'confirmed')) : actionable.pending;
  const disputedForMe = actionable.disputed;
  const cancellations = actionable.cancellations.filter((match) => !pendingForMe.includes(match));
  const detailsLink = (id: string) => !matchId && <button type="button" onClick={() => { onClose(); openMatch(id); }}
    className="min-h-[44px] text-xs font-bold text-amber-300 hover:underline">Spielinformationen →</button>;

  const setMatchFeedback = (matchId: string, result: ActionResult) =>
    setFeedback((prev) => ({ ...prev, [matchId]: { text: result.message, error: !result.success } }));

  const perform = async (matchId: string, action: () => unknown, fallbackError: string): Promise<boolean> => {
    if (busyMatchId) return false;
    setBusyMatchId(matchId);
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    const result = await runAction(action, { fallbackError });
    setBusyMatchId(null);
    setMatchFeedback(matchId, result);
    if (result.success) delete retries.current[matchId];
    else retries.current[matchId] = () => perform(matchId,action,fallbackError);
    return result.success;
  };

  const handleDisputeSubmit = async (match: Match) => {
    const reason = disputeReason.trim();
    if (!reason) {
      setMatchFeedback(match.id, { success: false, message: 'Bitte eine Begründung angeben.' });
      return;
    }
    if (reason.length > 1000) {
      setMatchFeedback(match.id, { success: false, message: 'Die Begründung darf höchstens 1000 Zeichen lang sein.' });
      return;
    }
    const a = parseScore(proposedScoreA);
    const b = parseScore(proposedScoreB);
    const scoreError = validateScore(a, b);
    if (scoreError) {
      setMatchFeedback(match.id, { success: false, message: scoreError });
      return;
    }
    const ok = await perform(match.id, () => disputeMatch(match.id, reason, a!, b!), 'Widerspruch konnte nicht gespeichert werden.');
    if (ok) {
      setDisputeId(null);
      setDisputeReason('');
    }
  };

  const handleSendCounter = async (match: Match) => {
    const a = parseScore(counterScoreA);
    const b = parseScore(counterScoreB);
    const scoreError = validateScore(a, b);
    if (scoreError) {
      setMatchFeedback(match.id, { success: false, message: scoreError });
      return;
    }
    const ok = await perform(
      match.id,
      () => proposeDisputeResolution(match.id, a!, b!, 'Gegenvorschlag'),
      'Gegenvorschlag konnte nicht gesendet werden.'
    );
    if (ok) setCounterId(null);
  };

  const handleCancel = async (match: Match) => {
    const state = getCancellationState(match, currentUser.id);
    const question = isAdmin
      ? 'Dieses Spiel als Administrator sofort annullieren?'
      : state === 'awaiting_my_approval'
      ? 'Der Streichung zustimmen? Das Spiel wird annulliert und nicht mehr gewertet.'
      : 'Streichung bei der Gegenseite beantragen? Das Spiel wird erst annulliert, wenn die Gegenseite zustimmt.';
    if (!window.confirm(question)) return;
    await perform(match.id, () => cancelMatchByMutualAgreement(match.id), 'Streichung konnte nicht verarbeitet werden.');
  };

  const renderFeedback = (matchId: string) => {
    const item = feedback[matchId];
    if (!item) return null;
    return (
      <div
        role={item.error ? 'alert' : 'status'}
        className={`mt-2 p-2 rounded-lg text-[11px] font-semibold flex items-start gap-1.5 ${
          item.error ? 'bg-red-950/80 border border-red-700 text-red-200' : 'bg-emerald-950/80 border border-emerald-600 text-emerald-200'
        }`}
      >
        {item.error ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />}
        <span className="break-words">{item.text}</span>
        {item.error && retries.current[matchId] && <button type="button" disabled={Boolean(busyMatchId)}
          onClick={() => void retries.current[matchId]?.()} className="min-h-[44px] shrink-0 underline disabled:opacity-50">Erneut versuchen</button>}
      </div>
    );
  };

  const renderCancellation = (match: Match) => {
    const state = getCancellationState(match, currentUser.id);
    const busy = busyMatchId === match.id;
    const requester = players.find((p) => p.id === match.cancellationRequestedBy);

    if (state === 'requested_by_my_side' && !isAdmin) {
      return (
        <span className="text-[11px] text-amber-300/80 italic">
          Streichung beantragt{requester ? ` von ${requester.id === currentUser.id ? 'dir' : requester.name}` : ''} – wartet auf Zustimmung der Gegenseite
        </span>
      );
    }
    const label = isAdmin
      ? 'Spiel annullieren (Admin)'
      : state === 'awaiting_my_approval'
      ? 'Streichung zustimmen'
      : 'Streichung beantragen';
    return (
      <div className="flex flex-col items-start gap-1">
        {state === 'awaiting_my_approval' && (
          <span className="text-[11px] text-red-300">
            {requester?.name || 'Die Gegenseite'} möchte dieses Spiel streichen.
          </span>
        )}
        <button
          type="button"
          disabled={Boolean(busyMatchId)}
          onClick={() => handleCancel(match)}
          className="min-h-[44px] px-2 -mx-2 text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {label}
        </button>
      </div>
    );
  };

  const nothingToDo = pendingForMe.length === 0 && disputedForMe.length === 0 && cancellations.length === 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" onClick={onClose}>
      <div
        className="modal-panel felt-card max-w-lg p-4 sm:p-5 space-y-5 border border-emerald-500/50 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute top-2.5 right-2.5 w-11 h-11 flex items-center justify-center text-emerald-400 hover:text-white rounded-lg bg-emerald-950/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pr-12">
          <h3 id="confirmation-title" className="font-display text-xl font-bold text-white">
            {matchId ? 'Ergebnis prüfen' : 'Neu für dich'}
          </h3>
          <p className="text-xs text-emerald-300/80 mt-0.5">
            Neue Ergebnisse ansehen oder strittige Spiele direkt mit der Gegenseite klären. Turnierspiele werden im Turnierbaum korrigiert.
          </p>
        </div>

        {/* 1. New results */}
        <section className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5 border-b border-emerald-900/40 pb-1">
            <Clock className="w-3.5 h-3.5" />
            {matchId ? 'Spielergebnis' : 'Neue Spielergebnisse'} ({pendingForMe.length})
          </div>

          {pendingForMe.length === 0 ? (
            <div className="py-3 text-center text-emerald-400/60 text-xs">Keine neuen Spielergebnisse vorhanden.</div>
          ) : (
            <div className="divide-y divide-emerald-900/40">
              {pendingForMe.map((m) => {
                const creator = players.find((p) => p.id === m.creatorId);
                const amInTeamA = teamOf(m, currentUser.id) === 'A';
                const myScore = amInTeamA ? m.scoreA : m.scoreB;
                const oppScore = amInTeamA ? m.scoreB : m.scoreA;
                const iWon = myScore > oppScore;
                const isDisputingThis = disputeId === m.id;
                const busy = busyMatchId === m.id;

                return (
                  <div key={m.id} className="py-3 space-y-2">
                    {detailsLink(m.id)}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-emerald-200">
                          <strong className="text-amber-300 font-semibold">{creator?.name || 'Unbekannt'}</strong> hat eingetragen:
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {iWon ? 'Du hast gewonnen' : 'Du hast verloren'} ({myScore} : {oppScore})
                        </div>
                        <div className="text-[10px] text-emerald-400/60 mt-0.5">
                          {m.date} • {m.mode} • {playerNames(players, m.teamA)} vs {playerNames(players, m.teamB)}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(busyMatchId) || m.confirmedBy.includes(currentUser.id)}
                        onClick={() => perform(m.id, () => acknowledgeMatch(m.id), 'Konnte nicht als gesehen markiert werden.')}
                        className="shrink-0 min-h-[44px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow disabled:opacity-60"
                      >
                        {busy && !isDisputingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        {m.confirmedBy.includes(currentUser.id) ? 'Bereits gesehen' : 'Gesehen'}
                      </button>
                    </div>

                    {m.cancellationRequestedBy && renderCancellation(m)}

                    {!isDisputingThis ? (
                      <button
                        type="button"
                        disabled={Boolean(busyMatchId)}
                        onClick={() => {
                          setCounterId(null);
                          setDisputeId(m.id);
                          setDisputeReason('');
                          setProposedScoreA(String(m.scoreA));
                          setProposedScoreB(String(m.scoreB));
                        }}
                        className="min-h-[44px] text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2"
                      >
                        Widersprechen / Ergebnis korrigieren
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-3 mt-2">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Ergebnis beanstanden & Korrektur vorschlagen:
                        </div>

                        <div className="flex items-end justify-center gap-3 bg-stone-900/80 p-2 rounded-lg border border-amber-900/60">
                          <label className="text-center">
                            <span className="text-[10px] text-emerald-400 block mb-0.5 max-w-[110px] truncate">
                              {playerNames(players, m.teamA)}
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={MAX_SCORE}
                              value={proposedScoreA}
                              onChange={(e) => setProposedScoreA(e.target.value)}
                              className={scoreInputClass}
                            />
                          </label>
                          <span className="text-sm font-bold text-white pb-3">:</span>
                          <label className="text-center">
                            <span className="text-[10px] text-emerald-400 block mb-0.5 max-w-[110px] truncate">
                              {playerNames(players, m.teamB)}
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={MAX_SCORE}
                              value={proposedScoreB}
                              onChange={(e) => setProposedScoreB(e.target.value)}
                              className={scoreInputClass}
                            />
                          </label>
                        </div>

                        <input
                          type="text"
                          value={disputeReason}
                          maxLength={1000}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="Begründung (z.B. Eigentlich ging das Spiel 10:8 aus)"
                          aria-label="Begründung"
                          className="w-full min-h-[44px] bg-stone-900 border border-amber-700/60 rounded-lg p-2 text-xs text-white placeholder-stone-400 focus:outline-none"
                        />

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDisputeId(null)}
                            className="min-h-[44px] px-3 text-xs text-stone-300 hover:text-white"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busyMatchId)}
                            onClick={() => handleDisputeSubmit(m)}
                            className="min-h-[44px] px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg shadow flex items-center gap-1 disabled:opacity-60"
                          >
                            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Widerspruch senden
                          </button>
                        </div>
                      </div>
                    )}
                    {renderFeedback(m.id)}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. Cancellation requests on non-disputed games */}
        {cancellations.length > 0 && (
          <section className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 border-b border-red-900/40 pb-1">
              <Trash2 className="w-3.5 h-3.5" />
              Streichungsanfragen ({cancellations.length})
            </div>
            {cancellations.map((m) => (
              <div key={m.id} className="p-3 rounded-xl bg-red-950/20 border border-red-700/40 space-y-1">
                {detailsLink(m.id)}
                <div className="text-xs font-bold text-white">
                  {playerNames(players, m.teamA)} vs {playerNames(players, m.teamB)} · {m.scoreA}:{m.scoreB}
                </div>
                <div className="text-[10px] text-emerald-400/60">{m.date} • {m.mode}</div>
                {renderCancellation(m)}
                {renderFeedback(m.id)}
              </div>
            ))}
          </section>
        )}

        {/* 3. Disputed games */}
        {disputedForMe.length > 0 && (
          <section className="space-y-3 pt-1">
            <div className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 border-b border-red-900/40 pb-1">
              <Swords className="w-3.5 h-3.5" />
              Strittige Spiele zur Einigung ({disputedForMe.length})
            </div>

            <div className="space-y-3">
              {disputedForMe.map((m) => {
                const teamANames = playerNames(players, m.teamA);
                const teamBNames = playerNames(players, m.teamB);
                const proposer = players.find((p) => p.id === m.disputeProposedBy);
                const isProposerMe = m.disputeProposedBy === currentUser.id;
                const proposerIsOpponent = isOpposingSide(m, m.disputeProposedBy, currentUser.id);
                const hasProposedScore = m.disputeProposedScoreA != null && m.disputeProposedScoreB != null;
                const isCountering = counterId === m.id;
                const busy = busyMatchId === m.id;

                return (
                  <div key={m.id} className="p-3 rounded-xl bg-red-950/20 border border-red-600/50 space-y-2.5">
                    {detailsLink(m.id)}
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-bold text-white">{teamANames} vs {teamBNames}</span>
                      <span className="text-[10px] text-red-400 font-semibold uppercase">Strittig ({m.date})</span>
                    </div>

                    <div className="text-xs text-stone-300">
                      <strong>Eingetragen:</strong> {m.scoreA} : {m.scoreB}
                      {m.disputeReason && (
                        <div className="mt-1 text-[11px] text-amber-300/90 italic break-words">&quot;{m.disputeReason}&quot;</div>
                      )}
                    </div>

                    {hasProposedScore && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/40 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-amber-400 font-bold uppercase">
                            {isProposerMe ? 'Dein Vorschlag:' : `Vorschlag von ${proposer?.name || 'Unbekannt'}:`}
                          </div>
                          <div className="font-mono text-base font-black text-white mt-0.5">
                            {m.disputeProposedScoreA} : {m.disputeProposedScoreB}
                          </div>
                        </div>

                        {proposerIsOpponent ? (
                          <button
                            type="button"
                            disabled={Boolean(busyMatchId)}
                            onClick={() => perform(m.id, () => acceptDisputeResolution(m.id), 'Vorschlag konnte nicht angenommen werden.')}
                            className="min-h-[44px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow disabled:opacity-60"
                          >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            Annehmen & werten
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-300/70 italic">Wartet auf Annahme durch die Gegenseite</span>
                        )}
                      </div>
                    )}

                    {!isCountering ? (
                      <div className="flex flex-wrap items-start justify-between gap-2 pt-1 border-t border-red-900/30 text-xs">
                        <button
                          type="button"
                          disabled={Boolean(busyMatchId)}
                          onClick={() => {
                            setDisputeId(null);
                            setCounterId(m.id);
                            setCounterScoreA(String(m.disputeProposedScoreA ?? m.scoreA));
                            setCounterScoreB(String(m.disputeProposedScoreB ?? m.scoreB));
                          }}
                          className="min-h-[44px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Anderen Score vorschlagen
                        </button>
                        {renderCancellation(m)}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-stone-900 border border-emerald-600/50 space-y-2 mt-2">
                        <div className="text-xs font-bold text-emerald-300">Dein Vorschlag ({teamANames} : {teamBNames}):</div>
                        <div className="flex items-center justify-center gap-3">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_SCORE}
                            aria-label={`Tore ${teamANames}`}
                            value={counterScoreA}
                            onChange={(e) => setCounterScoreA(e.target.value)}
                            className={scoreInputClass}
                          />
                          <span className="font-bold text-white">:</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_SCORE}
                            aria-label={`Tore ${teamBNames}`}
                            value={counterScoreB}
                            onChange={(e) => setCounterScoreB(e.target.value)}
                            className={scoreInputClass}
                          />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setCounterId(null)}
                            className="min-h-[44px] px-3 text-xs text-stone-300"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busyMatchId)}
                            onClick={() => handleSendCounter(m)}
                            className="min-h-[44px] px-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded-lg flex items-center gap-1 disabled:opacity-60"
                          >
                            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Vorschlag senden
                          </button>
                        </div>
                      </div>
                    )}
                    {renderFeedback(m.id)}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {nothingToDo && (
          <p className="text-center text-[11px] text-emerald-400/60">Alles erledigt – keine offenen Aktionen.</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:text-white text-xs font-bold"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
