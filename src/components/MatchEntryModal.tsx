'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MatchMode, Player } from '@/types';
import { useStore } from '@/lib/store';
import { ExternalLabel } from './ExternalLabel';
import { MAX_SCORE, runAction, validateScore } from '@/lib/matchViews';
import { X, Search, Check, AlertCircle, Loader2 } from 'lucide-react';
import { suggestedPlayers } from '@/lib/playerSuggestions';

interface MatchEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SlotType = 'partner' | 'opponent1' | 'opponent2';
type SubmitState = 'idle' | 'submitting' | 'success';

const DEFAULT_SCORE_A = 10;
const DEFAULT_SCORE_B = 7;
const SCORE_PRESETS: [number, number][] = [
  [10, 7],
  [10, 5],
  [10, 8],
  [10, 0],
  [7, 10],
];

export function MatchEntryModal({ isOpen, onClose }: MatchEntryModalProps) {
  const { currentUser, players, matches, submitMatch } = useStore();

  const [mode, setMode] = useState<MatchMode>('1v1');
  const [activeSlot, setActiveSlot] = useState<SlotType>('opponent1');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [opponent1Id, setOpponent1Id] = useState<string | null>(null);
  const [opponent2Id, setOpponent2Id] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState<number>(DEFAULT_SCORE_A);
  const [scoreB, setScoreB] = useState<number>(DEFAULT_SCORE_B);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ text: string; error?: boolean } | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const submitLock = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reset the form whenever the modal is closed so no stale state or timers survive.
  useEffect(() => {
    if (isOpen) return;
    clearCloseTimer();
    submitLock.current = false;
    setMode('1v1');
    setActiveSlot('opponent1');
    setPartnerId(null);
    setOpponent1Id(null);
    setOpponent2Id(null);
    setScoreA(DEFAULT_SCORE_A);
    setScoreB(DEFAULT_SCORE_B);
    setSearchQuery('');
    setNotification(null);
    setSubmitState('idle');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && submitState !== 'submitting') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, submitState]);

  if (!isOpen || !currentUser) return null;

  const isBusy = submitState !== 'idle';
  const isEligible = (p: Player | undefined): p is Player => Boolean(p && !p.isSuspended && p.id !== currentUser.id);
  const selectedIds = [partnerId, opponent1Id, opponent2Id].filter((id): id is string => Boolean(id));
  const activeSlotId = activeSlot === 'partner' ? partnerId : activeSlot === 'opponent1' ? opponent1Id : opponent2Id;

  const query = searchQuery.trim().toLowerCase();
  const filteredPlayers = suggestedPlayers(players, matches, currentUser.id, activeSlot === 'partner').filter(({player: p}) => {
    if (!isEligible(p)) return false;
    if (selectedIds.includes(p.id) && p.id !== activeSlotId) return false;
    if (mode === '1v1' && p.id === activeSlotId) return false;
    return query === '' || p.name.toLowerCase().includes(query);
  });

  const findPlayer = (id: string | null) => (id ? players.find((p) => p.id === id) : undefined);
  const partnerPlayer = findPlayer(partnerId);
  const opponent1Player = findPlayer(opponent1Id);
  const opponent2Player = findPlayer(opponent2Id);

  const clearFeedback = () => {
    if (notification?.error) setNotification(null);
  };

  const handleSelectPlayer = (player: Player) => {
    if (isBusy) return;
    clearFeedback();
    if (activeSlot === 'partner') {
      setPartnerId(player.id);
      setActiveSlot(opponent1Id ? (opponent2Id ? 'opponent1' : 'opponent2') : 'opponent1');
    } else if (activeSlot === 'opponent1') {
      setOpponent1Id(player.id);
      if (mode === '2v2') setActiveSlot(!opponent2Id ? 'opponent2' : !partnerId ? 'partner' : 'opponent1');
    } else {
      setOpponent2Id(player.id);
      if (!partnerId) setActiveSlot('partner');
      else if (!opponent1Id) setActiveSlot('opponent1');
    }
    setSearchQuery('');
  };

  const changeMode = (next: MatchMode) => {
    if (isBusy || next === mode) return;
    clearFeedback();
    setMode(next);
    if (next === '1v1') {
      setPartnerId(null);
      setOpponent2Id(null);
      setActiveSlot('opponent1');
    } else {
      setActiveSlot(partnerId ? (opponent1Id ? 'opponent2' : 'opponent1') : 'partner');
    }
  };

  const setScore = (side: 'A' | 'B', value: number) => {
    if (isBusy) return;
    clearFeedback();
    const clamped = Math.max(0, Math.min(MAX_SCORE, value));
    if (side === 'A') setScoreA(clamped);
    else setScoreB(clamped);
  };

  const handleSubmit = async () => {
    if (submitLock.current || isBusy) return;

    const opponent1 = findPlayer(opponent1Id);
    const opponent2 = findPlayer(opponent2Id);
    const partner = findPlayer(partnerId);

    if (!isEligible(opponent1)) {
      setNotification({ text: 'Bitte wähle einen (nicht gesperrten) Gegner aus.', error: true });
      return;
    }
    if (mode === '2v2' && (!isEligible(partner) || !isEligible(opponent2))) {
      setNotification({ text: 'Für ein 2 gegen 2 werden 4 verschiedene, nicht gesperrte Spieler benötigt.', error: true });
      return;
    }
    const teamA = mode === '1v1' ? [currentUser.id] : [currentUser.id, partner!.id];
    const teamB = mode === '1v1' ? [opponent1.id] : [opponent1.id, opponent2!.id];
    if (new Set([...teamA, ...teamB]).size !== teamA.length + teamB.length) {
      setNotification({ text: 'Jeder Spieler darf nur einmal ausgewählt werden.', error: true });
      return;
    }
    const scoreError = validateScore(scoreA, scoreB);
    if (scoreError) {
      setNotification({ text: scoreError, error: true });
      return;
    }

    submitLock.current = true;
    setSubmitState('submitting');
    setNotification(null);

    const res = await runAction(
      () => submitMatch({ mode, teamA, teamB, scoreA, scoreB }),
      { fallbackError: 'Spiel konnte nicht gespeichert werden.' }
    );
    if (!isMounted.current) return;

    if (!res.success) {
      submitLock.current = false;
      setSubmitState('idle');
      setNotification({ text: res.message, error: true });
      return;
    }

    setSubmitState('success');
    setNotification({ text: res.message });
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, 1400);
  };

  const slotButton = (slot: SlotType, player: Player | undefined, label: string, emptyLabel: string) => (
    <button
      type="button"
      disabled={isBusy}
      onClick={() => setActiveSlot(slot)}
      aria-pressed={activeSlot === slot}
      aria-label={player ? `${label}: ${player.name} – ändern` : `${emptyLabel} auswählen`}
      className={`w-[4.25rem] h-20 rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
        activeSlot === slot
          ? 'border-2 border-amber-400 bg-amber-500/10'
          : 'border-2 border-dashed border-emerald-600/50 bg-emerald-950/30'
      }`}
    >
      {player ? (
        <>
          <div className="w-8 h-8 rounded-full bg-emerald-700/40 border border-emerald-400 flex items-center justify-center text-sm">
            {player.avatar}
          </div>
          <div className="text-[11px] font-bold text-white mt-1 truncate max-w-[60px]">{player.name}</div>
          <div className="text-[9px] text-emerald-400">{label}</div>
        </>
      ) : (
        <>
          <span className="text-xl text-emerald-400 font-light">+</span>
          <span className="text-[10px] text-emerald-300 font-semibold mt-1">{emptyLabel}</span>
        </>
      )}
    </button>
  );

  const stepper = (side: 'A' | 'B', value: number, label: string) => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-emerald-300 font-semibold">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isBusy || value <= 0}
          onClick={() => setScore(side, value - 1)}
          aria-label={`${label}: ein Tor weniger`}
          className="w-11 h-11 rounded-lg bg-emerald-900 border border-emerald-700 text-white font-bold flex items-center justify-center text-lg disabled:opacity-40"
        >
          −
        </button>
        <span className="font-mono text-2xl font-black text-amber-400 w-8 text-center" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          disabled={isBusy || value >= MAX_SCORE}
          onClick={() => setScore(side, value + 1)}
          aria-label={`${label}: ein Tor mehr`}
          className="w-11 h-11 rounded-lg bg-emerald-900 border border-emerald-700 text-white font-bold flex items-center justify-center text-lg disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="match-entry-title">
      <div className="modal-panel felt-card max-w-lg p-4 sm:p-5 space-y-4 border border-emerald-500/40 shadow-2xl relative my-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={submitState === 'submitting'}
          aria-label="Schließen"
          className="absolute top-2.5 right-2.5 w-11 h-11 flex items-center justify-center text-emerald-400 hover:text-white rounded-lg bg-emerald-950/60 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pt-1 px-10">
          <h2 id="match-entry-title" className="font-display text-2xl font-bold text-white">
            Spiel eintragen
          </h2>
          <p className="text-xs text-emerald-300/80 mt-1">Mit wem und gegen wen hast du gespielt?</p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#07160f] p-1 rounded-xl border border-emerald-900/60">
          {(['1v1', '2v2'] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={isBusy}
              onClick={() => changeMode(m)}
              aria-pressed={mode === m}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition-all ${
                mode === m ? 'bg-amber-400 text-stone-950 shadow-md font-black' : 'text-emerald-200/70 hover:text-white'
              }`}
            >
              {m === '1v1' ? '1 gegen 1' : '2 gegen 2'}
            </button>
          ))}
        </div>

        {/* Lineup */}
        <div className="flex items-center justify-between gap-1 py-1">
          <div className="flex-1 space-y-1 text-center">
            <div className="text-[10px] font-bold uppercase text-emerald-400/80">Dein Team</div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-[4.25rem] h-20 rounded-xl bg-emerald-900/40 border-2 border-amber-400 flex flex-col items-center justify-center p-1 shadow-inner">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-sm">
                  {currentUser.avatar}
                </div>
                <div className="text-[11px] font-bold text-white mt-1 truncate max-w-[60px]">{currentUser.name}</div>
                <div className="text-[9px] text-amber-400">Ich</div>
              </div>
              {mode === '2v2' && slotButton('partner', partnerPlayer, 'Partner', 'Partner')}
            </div>
          </div>

          <span className="shrink-0 text-xs font-black text-amber-400 uppercase tracking-widest px-1.5 py-1 rounded bg-[#07160f] border border-amber-500/30">
            VS
          </span>

          <div className="flex-1 space-y-1 text-center">
            <div className="text-[10px] font-bold uppercase text-emerald-400/80">Gegner</div>
            <div className="flex items-center justify-center gap-1.5">
              {slotButton('opponent1', opponent1Player, mode === '2v2' ? 'Gegner 1' : 'Gegner', 'Gegner')}
              {mode === '2v2' && slotButton('opponent2', opponent2Player, 'Gegner 2', 'Gegner')}
            </div>
          </div>
        </div>

        {/* Player picker */}
        <div className="bg-[#07160f]/70 rounded-xl p-3 border border-emerald-900/60">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-xs font-bold text-amber-300">
              {activeSlot === 'partner'
                ? 'Wer war dein Partner?'
                : activeSlot === 'opponent1'
                ? 'Wer war dein Gegner?'
                : 'Wer war der zweite Gegner?'}
            </span>
            <span className="text-[10px] text-emerald-400/70 shrink-0">Gesperrte Spieler ausgeblendet</span>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              disabled={isBusy}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Spieler suchen ..."
              aria-label="Spieler suchen"
              className="w-full min-h-[44px] bg-emerald-950/80 border border-emerald-800/60 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-emerald-400/50 focus:outline-none focus:border-amber-400"
            />
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="py-4 text-center text-xs text-emerald-400/60">
              {query ? 'Kein passender Spieler gefunden.' : 'Keine weiteren auswählbaren Spieler.'}
            </div>
          ) : (
            <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-2 max-h-44 overflow-y-auto overscroll-contain pr-1">
              {filteredPlayers.map(({player: p, count}) => {
                const isCurrentSlot = p.id === activeSlotId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSelectPlayer(p)}
                    aria-pressed={isCurrentSlot}
                    className={`min-h-[64px] p-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all active:scale-95 ${
                      isCurrentSlot
                        ? 'bg-amber-500/15 border-amber-400'
                        : 'bg-[#0d261a] border-emerald-700/40 hover:border-amber-400/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-stone-800 to-stone-950 border border-amber-500/60 flex items-center justify-center text-sm shadow mb-1">
                      {p.avatar}
                    </div>
                    <div className="text-[11px] font-bold text-white truncate w-full">{p.name}</div>
                    {count > 0 && <span className="text-[9px] text-amber-300">{count}× {activeSlot === 'partner' ? 'Partner' : 'Gegner'}</span>}
                    <div className="text-[9px] text-emerald-400/70">{p.isExternal ? <ExternalLabel /> : `(${p.yearJoined})`}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
          <div className="text-center text-xs font-bold text-white mb-2">Spielergebnis (Tore, max. {MAX_SCORE})</div>
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            {stepper('A', scoreA, 'Dein Team')}
            <span className="text-xl font-black text-emerald-400 pt-4">:</span>
            {stepper('B', scoreB, 'Gegner')}
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-emerald-400/60 mr-1">Presets:</span>
            {SCORE_PRESETS.map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setScore('A', a);
                  setScore('B', b);
                }}
                className={`min-h-[36px] min-w-[44px] px-2 rounded-lg text-[11px] font-bold border transition-colors ${
                  scoreA === a && scoreB === b
                    ? 'bg-amber-400 text-stone-950 border-amber-400'
                    : 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800'
                }`}
              >
                {a}:{b}
              </button>
            ))}
          </div>
          {scoreA === scoreB && (
            <p className="mt-2 text-center text-[11px] text-red-300">Unentschieden ist nicht möglich.</p>
          )}
        </div>

        {notification && (
          <div
            role={notification.error ? 'alert' : 'status'}
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              notification.error
                ? 'bg-red-950/80 border border-red-700 text-red-200'
                : 'bg-emerald-950/80 border border-emerald-600 text-emerald-200'
            }`}
          >
            {notification.error ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span className="break-words">{notification.text}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy}
          className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {submitState === 'submitting' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Wird gespeichert…
            </>
          ) : submitState === 'success' ? (
            <>
              <Check className="w-5 h-5 stroke-[3]" />
              Gespeichert
            </>
          ) : (
            <>
              <Check className="w-5 h-5 stroke-[3]" />
              {notification?.error ? 'Erneut versuchen' : 'Ergebnis verbindlich melden'}
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-emerald-400/60">
          * Das Ergebnis ist sofort wirksam. Die Gegenseite wird benachrichtigt und kann widersprechen.
        </p>
      </div>
    </div>
  );
}
