'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Match, MatchStatus, MatchMode } from '@/types';
import {
  getCancellationState,
  isAdminRole,
  isMatchCounted,
  isOpposingSide,
  runAction,
  teamOf,
} from '@/lib/matchViews';
import { Swords, CheckCircle2, Clock, AlertTriangle, Ban, Crown, Loader2, AlertCircle } from 'lucide-react';

type Feedback = { text: string; error: boolean };

const STATUS_FILTERS: { id: 'all' | MatchStatus; label: string }[] = [
  { id: 'all', label: 'Alle Status' },
  { id: 'confirmed', label: 'Bestätigt' },
  { id: 'pending', label: 'Wirksam' },
  { id: 'disputed', label: 'Strittig' },
  { id: 'cancelled', label: 'Annulliert' },
];

function StatusBadge({ match }: { match: Match }) {
  const counted = isMatchCounted(match);
  const base = 'px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 text-[10px] whitespace-nowrap';
  if (match.status === 'cancelled') {
    return (
      <span className={`${base} bg-stone-700/30 text-stone-300 border-stone-500/40`}>
        <Ban className="w-3 h-3" />
        Annulliert
      </span>
    );
  }
  if (match.status === 'disputed') {
    return (
      <span className={`${base} bg-red-500/20 text-red-400 border-red-500/30`}>
        <AlertTriangle className="w-3 h-3" />
        Strittig
      </span>
    );
  }
  if (match.status === 'confirmed') {
    return (
      <span className={`${base} bg-emerald-500/20 text-neon-lime border-emerald-500/30`}>
        <CheckCircle2 className="w-3 h-3" />
        Bestätigt
      </span>
    );
  }
  return (
    <span className={`${base} bg-amber-500/20 text-amber-400 border-amber-500/30`}>
      <Clock className="w-3 h-3" />
      {counted ? 'Wirksam · Widerspruch möglich' : 'Ausstehend'}
    </span>
  );
}

export function MatchesView({ onOpenMatchEntry }: { onOpenMatchEntry: () => void }) {
  const { matches, players, currentUser, acceptDisputeResolution, cancelMatchByMutualAgreement } = useStore();
  const [filterMode, setFilterMode] = useState<'all' | MatchMode>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | MatchStatus>('all');
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const isAdmin = isAdminRole(currentUser?.role);

  const filteredMatches = matches.filter((m) => {
    if (filterMode !== 'all' && m.mode !== filterMode) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  const perform = async (matchId: string, action: () => unknown, fallbackError: string) => {
    if (busyMatchId) return;
    setBusyMatchId(matchId);
    const result = await runAction(action, { fallbackError });
    setBusyMatchId(null);
    setFeedback((prev) => ({ ...prev, [matchId]: { text: result.message, error: !result.success } }));
  };

  const handleCancel = (m: Match) => {
    const state = getCancellationState(m, currentUser?.id);
    const question = isAdmin
      ? 'Dieses Spiel als Administrator sofort annullieren?'
      : state === 'awaiting_my_approval'
      ? 'Der Streichung zustimmen? Das Spiel wird annulliert.'
      : 'Streichung bei der Gegenseite beantragen?';
    if (!window.confirm(question)) return;
    void perform(m.id, () => cancelMatchByMutualAgreement(m.id), 'Streichung konnte nicht verarbeitet werden.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Swords className="w-6 h-6 text-amber-400" />
            Spiele & Ergebnisse
          </h2>
          <p className="text-xs text-emerald-300/80">Historie aller Liga- und Turnierbegegnungen</p>
        </div>

        <button
          type="button"
          onClick={onOpenMatchEntry}
          className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow flex items-center gap-1.5"
        >
          <span>+</span> Spiel eintragen
        </button>
      </div>

      <div className="space-y-1.5 bg-[#07160f]/60 p-2 rounded-2xl border border-emerald-900/60">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" role="group" aria-label="Modus filtern">
          {(['all', '1v1', '2v2'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMode(m)}
              aria-pressed={filterMode === m}
              className={`min-h-[44px] px-3 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                filterMode === m ? 'bg-amber-400 text-stone-950 font-black' : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              {m === 'all' ? 'Alle Modi' : m === '1v1' ? '1 gegen 1' : '2 gegen 2'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" role="group" aria-label="Status filtern">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterStatus(s.id)}
              aria-pressed={filterStatus === s.id}
              className={`min-h-[44px] px-3 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                filterStatus === s.id ? 'bg-emerald-600 text-white font-black' : 'text-emerald-300/60 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredMatches.length === 0 ? (
          <div className="felt-card p-8 text-center text-emerald-300/60 text-xs">
            Keine Spiele mit diesen Filterkriterien gefunden.
          </div>
        ) : (
          filteredMatches.map((m) => {
            const teamAPlayers = m.teamA.map((id) => getPlayer(id));
            const teamBPlayers = m.teamB.map((id) => getPlayer(id));
            const isWinnerA = m.scoreA > m.scoreB;
            const counted = isMatchCounted(m);
            const isCancelled = m.status === 'cancelled';
            const myTeam = teamOf(m, currentUser?.id);
            const isParticipant = myTeam !== null;
            const isTournament = Boolean(m.tournamentId);
            const cancelState = getCancellationState(m, currentUser?.id);
            const canAccept =
              m.status === 'disputed' &&
              m.disputeProposedScoreA != null &&
              m.disputeProposedScoreB != null &&
              isOpposingSide(m, m.disputeProposedBy, currentUser?.id);
            const busy = busyMatchId === m.id;
            const item = feedback[m.id];

            const nameClass = (winner: boolean) =>
              isCancelled ? 'text-slate-400 line-through' : winner ? 'text-amber-300' : 'text-slate-300';

            return (
              <div
                key={m.id}
                className={`felt-card p-3.5 sm:p-4 transition-all relative overflow-hidden ${
                  m.status === 'disputed'
                    ? 'border-red-600/50 bg-red-950/20'
                    : isCancelled
                    ? 'opacity-70'
                    : m.status === 'pending'
                    ? 'border-amber-600/40 bg-amber-950/10'
                    : 'border-emerald-800/40'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] mb-3 border-b border-emerald-900/30 pb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-emerald-400">{m.date}</span>
                    <span aria-hidden>•</span>
                    <span className="text-emerald-300/80 uppercase font-bold text-[10px]">{m.mode}</span>
                    {isTournament && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Turnier
                      </span>
                    )}
                    {!counted && !isCancelled && (
                      <span className="px-1.5 py-0.5 rounded bg-stone-700/40 text-stone-300 border border-stone-500/40 text-[10px] font-bold">
                        Nicht gewertet
                      </span>
                    )}
                    {cancelState !== 'none' && (
                      <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-700/40 text-[10px] font-bold">
                        Streichung beantragt
                      </span>
                    )}
                  </div>
                  <StatusBadge match={m} />
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="text-right min-w-0">
                    {teamAPlayers.map((p, i) => (
                      <div key={p?.id || i} className={`text-xs font-bold truncate ${nameClass(isWinnerA)}`}>
                        {p?.name || 'Unbekannt'}
                      </div>
                    ))}
                    {counted && m.eloChangeA !== 0 && (
                      <div className={`text-[10px] font-mono font-bold mt-1 ${m.eloChangeA > 0 ? 'text-neon-lime' : 'text-red-400'}`}>
                        {m.eloChangeA > 0 ? `+${m.eloChangeA}` : m.eloChangeA} ELO
                      </div>
                    )}
                  </div>

                  <div className="font-mono text-lg sm:text-xl font-black text-white bg-[#06140d] px-2 py-1 rounded-xl border border-emerald-800/60 shadow-inner whitespace-nowrap">
                    {m.scoreA}:{m.scoreB}
                  </div>

                  <div className="text-left min-w-0">
                    {teamBPlayers.map((p, i) => (
                      <div key={p?.id || i} className={`text-xs font-bold truncate ${nameClass(!isWinnerA)}`}>
                        {p?.name || 'Unbekannt'}
                      </div>
                    ))}
                    {counted && m.eloChangeB !== 0 && (
                      <div className={`text-[10px] font-mono font-bold mt-1 ${m.eloChangeB > 0 ? 'text-neon-lime' : 'text-red-400'}`}>
                        {m.eloChangeB > 0 ? `+${m.eloChangeB}` : m.eloChangeB} ELO
                      </div>
                    )}
                  </div>
                </div>

                {m.status === 'disputed' && (
                  <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-700/50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-red-300 font-bold break-words">
                        Strittig gemeldet{m.disputeReason ? `: ${m.disputeReason}` : ''}
                      </span>
                      {m.disputeProposedScoreA != null && m.disputeProposedScoreB != null && (
                        <span className="font-mono text-amber-300 font-bold bg-stone-900 px-2 py-0.5 rounded border border-amber-600/40">
                          Vorschlag: {m.disputeProposedScoreA} : {m.disputeProposedScoreB}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!isCancelled && isTournament && (isAdmin || (isParticipant && m.status === 'disputed')) && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <p className="text-purple-300/80">
                      Turnierergebnisse werden im Turnierbaum durch die Organisation korrigiert.
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={Boolean(busyMatchId)}
                        onClick={() => {
                          if (!window.confirm('Turnierspiel zurücksetzen? Abhängige Runden werden ebenfalls zurückgesetzt.')) return;
                          void perform(m.id, () => cancelMatchByMutualAgreement(m.id), 'Turnierspiel konnte nicht zurückgesetzt werden.');
                        }}
                        className="min-h-[44px] px-3 text-red-300 hover:text-white rounded-lg bg-red-900/40 disabled:opacity-50"
                      >
                        Turnierspiel zurücksetzen (Admin)
                      </button>
                    )}
                    {busy && <Loader2 className="w-4 h-4 animate-spin text-emerald-300" aria-label="Wird verarbeitet" />}
                  </div>
                )}

                {!isCancelled && !isTournament && (isParticipant || isAdmin) && (m.status === 'disputed' || cancelState !== 'none') && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-red-900/40 text-xs">
                    {cancelState === 'requested_by_my_side' && !isAdmin ? (
                      <span className="text-[11px] text-amber-300/80 italic">Streichung beantragt – wartet auf Gegenseite</span>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(busyMatchId)}
                        onClick={() => handleCancel(m)}
                        className="min-h-[44px] px-3 text-red-300 hover:text-white rounded-lg bg-red-900/40 disabled:opacity-50"
                      >
                        {isAdmin
                          ? 'Annullieren (Admin)'
                          : cancelState === 'awaiting_my_approval'
                          ? 'Streichung zustimmen'
                          : 'Streichung beantragen'}
                      </button>
                    )}

                    {canAccept && (
                      <button
                        type="button"
                        disabled={Boolean(busyMatchId)}
                        onClick={() => perform(m.id, () => acceptDisputeResolution(m.id), 'Vorschlag konnte nicht angenommen werden.')}
                        className="min-h-[44px] px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow disabled:opacity-50"
                      >
                        Vorschlag ({m.disputeProposedScoreA}:{m.disputeProposedScoreB}) annehmen
                      </button>
                    )}
                    {busy && <Loader2 className="w-4 h-4 animate-spin text-emerald-300" aria-label="Wird verarbeitet" />}
                  </div>
                )}

                {item && (
                  <div
                    role={item.error ? 'alert' : 'status'}
                    className={`mt-2 p-2 rounded-lg text-[11px] font-semibold flex items-start gap-1.5 ${
                      item.error ? 'bg-red-950/80 border border-red-700 text-red-200' : 'bg-emerald-950/80 border border-emerald-600 text-emerald-200'
                    }`}
                  >
                    {item.error ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span className="break-words">{item.text}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
