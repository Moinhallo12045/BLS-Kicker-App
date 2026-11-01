'use client';

import React, { useState } from 'react';
import { MatchMode, Player } from '@/types';
import { useStore } from '@/lib/store';
import { X, Search, Check, AlertCircle } from 'lucide-react';

interface MatchEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SlotType = 'partner' | 'opponent1' | 'opponent2';

export function MatchEntryModal({ isOpen, onClose }: MatchEntryModalProps) {
  const { currentUser, players, submitMatch } = useStore();

  const [mode, setMode] = useState<MatchMode>('1v1');
  const [activeSlot, setActiveSlot] = useState<SlotType>('opponent1');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [opponent1Id, setOpponent1Id] = useState<string | null>(null);
  const [opponent2Id, setOpponent2Id] = useState<string | null>(null);

  const [scoreA, setScoreA] = useState<number>(10);
  const [scoreB, setScoreB] = useState<number>(7);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isOpen || !currentUser) return null;

  // Filter available players (excluding myself and already selected teammates/opponents)
  const filteredPlayers = players.filter((p) => {
    if (p.id === currentUser.id) return false;
    if (searchQuery.trim() === '') return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const partnerPlayer = players.find((p) => p.id === partnerId);
  const opponent1Player = players.find((p) => p.id === opponent1Id);
  const opponent2Player = players.find((p) => p.id === opponent2Id);

  const handleSelectPlayer = (player: Player) => {
    if (activeSlot === 'partner') {
      setPartnerId(player.id);
      setActiveSlot('opponent1');
    } else if (activeSlot === 'opponent1') {
      setOpponent1Id(player.id);
      if (mode === '2v2') setActiveSlot('opponent2');
    } else if (activeSlot === 'opponent2') {
      setOpponent2Id(player.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!opponent1Id) {
      setNotification({ text: 'Bitte wähle mindestens einen Gegner aus.', error: true });
      return;
    }

    if (mode === '2v2' && (!partnerId || !opponent2Id)) {
      setNotification({ text: 'Für ein 2 gegen 2 werden alle 4 Spieler benötigt.', error: true });
      return;
    }

    if (scoreA === scoreB) {
      setNotification({ text: 'Beim Tischkicker gibt es kein Unentschieden.', error: true });
      return;
    }

    const teamA = mode === '1v1' ? [currentUser.id] : [currentUser.id, partnerId!];
    const teamB = mode === '1v1' ? [opponent1Id] : [opponent1Id, opponent2Id!];

    const res = submitMatch({
      mode,
      teamA,
      teamB,
      scoreA,
      scoreB,
    });

    if (res.success) {
      setNotification({ text: res.message });
      setTimeout(() => {
        onClose();
        // Reset modal state
        setPartnerId(null);
        setOpponent1Id(null);
        setOpponent2Id(null);
        setScoreA(10);
        setScoreB(7);
        setNotification(null);
      }, 1400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="felt-card max-w-lg w-full p-5 space-y-4 border border-emerald-500/40 shadow-2xl relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-emerald-400 hover:text-white p-1 rounded-lg bg-emerald-950/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pt-1">
          <h2 className="font-display text-2xl font-bold text-white">
            Spiel eintragen
          </h2>
          <p className="text-xs text-emerald-300/80 mt-1">
            Mit wem und gegen wen hast du gespielt?
          </p>
        </div>

        {/* Mode Selector (Directly matching Screenshot 4) */}
        <div className="grid grid-cols-2 gap-2 bg-[#07160f] p-1 rounded-xl border border-emerald-900/60">
          <button
            type="button"
            onClick={() => {
              setMode('1v1');
              setActiveSlot('opponent1');
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              mode === '1v1'
                ? 'bg-amber-400 text-stone-950 shadow-md font-black'
                : 'text-emerald-200/70 hover:text-white'
            }`}
          >
            1 gegen 1
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('2v2');
              if (!partnerId) setActiveSlot('partner');
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              mode === '2v2'
                ? 'bg-amber-400 text-stone-950 shadow-md font-black'
                : 'text-emerald-200/70 hover:text-white'
            }`}
          >
            2 gegen 2
          </button>
        </div>

        {/* Matchup Lineup Display (Matching Screenshot 4) */}
        <div className="grid grid-cols-5 items-center gap-1.5 py-2">
          {/* Team Dein Team (Col 1 & 2) */}
          <div className="col-span-2 space-y-1 text-center">
            <div className="text-[10px] font-bold uppercase text-emerald-400/80">Dein Team</div>
            <div className="flex items-center justify-center gap-2">
              {/* Slot: Ich */}
              <div className="w-16 h-20 rounded-xl bg-emerald-900/40 border-2 border-amber-400 flex flex-col items-center justify-center p-1 shadow-inner">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-xs font-bold text-amber-300">
                  {currentUser.level}
                </div>
                <div className="text-[11px] font-bold text-white mt-1 truncate max-w-[56px]">
                  {currentUser.name}
                </div>
                <div className="text-[9px] text-amber-400">Ich</div>
              </div>

              {/* Slot: Partner (if 2v2) */}
              {mode === '2v2' && (
                <button
                  type="button"
                  onClick={() => setActiveSlot('partner')}
                  className={`w-16 h-20 rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                    activeSlot === 'partner'
                      ? 'border-2 border-amber-400 bg-amber-500/10'
                      : 'border-2 border-dashed border-emerald-600/50 bg-emerald-950/30'
                  }`}
                >
                  {partnerPlayer ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-emerald-700/40 border border-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                        {partnerPlayer.avatar}
                      </div>
                      <div className="text-[11px] font-bold text-white mt-1 truncate max-w-[56px]">
                        {partnerPlayer.name}
                      </div>
                      <div className="text-[9px] text-emerald-400">Partner</div>
                    </>
                  ) : (
                    <>
                      <span className="text-xl text-emerald-400 font-light">+</span>
                      <span className="text-[10px] text-emerald-300 font-semibold mt-1">
                        Partner
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* VS Center Indicator */}
          <div className="col-span-1 text-center">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest px-2 py-1 rounded bg-[#07160f] border border-amber-500/30">
              VS
            </span>
          </div>

          {/* Team Gegner (Col 4 & 5) */}
          <div className="col-span-2 space-y-1 text-center">
            <div className="text-[10px] font-bold uppercase text-emerald-400/80">Gegner</div>
            <div className="flex items-center justify-center gap-2">
              {/* Opponent 1 Slot */}
              <button
                type="button"
                onClick={() => setActiveSlot('opponent1')}
                className={`w-16 h-20 rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                  activeSlot === 'opponent1'
                    ? 'border-2 border-amber-400 bg-amber-500/10'
                    : 'border-2 border-dashed border-emerald-600/50 bg-emerald-950/30'
                }`}
              >
                {opponent1Player ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-emerald-700/40 border border-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                      {opponent1Player.avatar}
                    </div>
                    <div className="text-[11px] font-bold text-white mt-1 truncate max-w-[56px]">
                      {opponent1Player.name}
                    </div>
                    <div className="text-[9px] text-emerald-400">Gegner 1</div>
                  </>
                ) : (
                  <>
                    <span className="text-xl text-emerald-400 font-light">+</span>
                    <span className="text-[10px] text-emerald-300 font-semibold mt-1">
                      Gegner
                    </span>
                  </>
                )}
              </button>

              {/* Opponent 2 Slot (if 2v2) */}
              {mode === '2v2' && (
                <button
                  type="button"
                  onClick={() => setActiveSlot('opponent2')}
                  className={`w-16 h-20 rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                    activeSlot === 'opponent2'
                      ? 'border-2 border-amber-400 bg-amber-500/10'
                      : 'border-2 border-dashed border-emerald-600/50 bg-emerald-950/30'
                  }`}
                >
                  {opponent2Player ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-emerald-700/40 border border-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                        {opponent2Player.avatar}
                      </div>
                      <div className="text-[11px] font-bold text-white mt-1 truncate max-w-[56px]">
                        {opponent2Player.name}
                      </div>
                      <div className="text-[9px] text-emerald-400">Gegner 2</div>
                    </>
                  ) : (
                    <>
                      <span className="text-xl text-emerald-400 font-light">+</span>
                      <span className="text-[10px] text-emerald-300 font-semibold mt-1">
                        Gegner
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Slot Prompt & Player Picker (Matching Screenshot 4) */}
        <div className="bg-[#07160f]/70 rounded-xl p-3 border border-emerald-900/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-300">
              {activeSlot === 'partner'
                ? 'Wer war dein Partner?'
                : activeSlot === 'opponent1'
                ? 'Wer war dein Gegner?'
                : 'Wer war der zweite Gegner?'}
            </span>
            <span className="text-[10px] text-emerald-400/70">Wähle unten aus</span>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Spieler suchen ..."
              className="w-full bg-emerald-950/80 border border-emerald-800/60 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-emerald-400/50 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Grid of Players (Matching Screenshot 4 circles) */}
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
            {filteredPlayers.map((p, idx) => {
              const isSelected =
                p.id === partnerId || p.id === opponent1Id || p.id === opponent2Id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isSelected}
                  onClick={() => handleSelectPlayer(p)}
                  className={`p-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    isSelected
                      ? 'opacity-30 border-transparent bg-stone-900'
                      : 'bg-[#0d261a] border-emerald-700/40 hover:border-amber-400/80 hover:scale-105 active:scale-95'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-b from-stone-800 to-stone-950 border border-amber-500/60 flex items-center justify-center text-xs font-bold shadow mb-1">
                    {idx + 1}
                  </div>
                  <div className="text-[11px] font-bold text-white truncate w-full">
                    {p.name}
                  </div>
                  <div className="text-[9px] text-emerald-400/70">
                    ({p.yearJoined})
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Score Stepper (e.g. 10 : 7) */}
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
          <div className="text-center text-xs font-bold text-white mb-2">
            Spielergebnis (Tore)
          </div>
          <div className="flex items-center justify-center gap-6">
            {/* Score Dein Team */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-emerald-300 font-semibold">Dein Team</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScoreA(Math.max(0, scoreA - 1))}
                  className="w-7 h-7 rounded-lg bg-emerald-900 border border-emerald-700 text-white font-bold flex items-center justify-center text-base"
                >
                  -
                </button>
                <span className="font-mono text-2xl font-black text-amber-400 w-8 text-center">
                  {scoreA}
                </span>
                <button
                  type="button"
                  onClick={() => setScoreA(scoreA + 1)}
                  className="w-7 h-7 rounded-lg bg-emerald-900 border border-emerald-700 text-white font-bold flex items-center justify-center text-base"
                >
                  +
                </button>
              </div>
            </div>

            <span className="text-xl font-black text-emerald-400">:</span>

            {/* Score Gegner */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-emerald-300 font-semibold">Gegner</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScoreB(Math.max(0, scoreB - 1))}
                  className="w-7 h-7 rounded-lg bg-emerald-900 border border-emerald-700 text-white font-bold flex items-center justify-center text-base"
                >
                  -
                </button>
                <span className="font-mono text-2xl font-black text-amber-400 w-8 text-center">
                  {scoreB}
                </span>
                <button
                  type="button"
                  onClick={() => setScoreB(scoreB + 1)}
                  className="w-7 h-7 rounded-lg bg-emerald-900 border border-emerald-700 text-white font-bold flex items-center justify-center text-base"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Quick presets (10:0, 10:5, 10:8, etc.) */}
          <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-emerald-400/60 mr-1">Presets:</span>
            {[
              [10, 7],
              [10, 5],
              [10, 8],
              [10, 0],
              [7, 10],
            ].map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                onClick={() => {
                  setScoreA(a);
                  setScoreB(b);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  scoreA === a && scoreB === b
                    ? 'bg-amber-400 text-stone-950 border-amber-400'
                    : 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800'
                }`}
              >
                {a}:{b}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback alert */}
        {notification && (
          <div
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
            {notification.text}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          Ergebnis verbindlich melden
        </button>

        <p className="text-[10px] text-center text-emerald-400/60">
          * Der Gegner erhält eine Bestätigungsanfrage. Erst nach Bestätigung erfolgt die Wertung.
        </p>
      </div>
    </div>
  );
}
