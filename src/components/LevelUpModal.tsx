'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getTierForLevel } from '@/lib/levels';
import confetti from 'canvas-confetti';
import { Sparkles } from 'lucide-react';
import { MAX_LEVEL } from '@/lib/matchViews';

export function LevelUpModal() {
  const { newLevelUnlocked, clearLevelModal } = useStore();

  useEffect(() => {
    if (!newLevelUnlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearLevelModal();
    };
    window.addEventListener('keydown', onKey);

    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!reducedMotion) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#f59e0b', '#fbbf24', '#ffffff'] });
      timer = setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
      }, 300);
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timer) clearTimeout(timer);
    };
  }, [newLevelUnlocked, clearLevelModal]);

  if (!newLevelUnlocked) return null;

  const { player, oldLevel } = newLevelUnlocked;
  const newLevel = Math.min(MAX_LEVEL, newLevelUnlocked.newLevel);
  const tier = getTierForLevel(newLevel);
  const oldTier = getTierForLevel(oldLevel);
  const tierChanged = oldTier.tier !== tier.tier;
  const isMax = newLevel >= MAX_LEVEL;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <div className="modal-panel felt-card max-w-sm p-5 sm:p-6 text-center space-y-4 border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.4)] my-auto">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 p-1 shadow-lg flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-stone-950 flex items-center justify-center text-3xl">🏆</div>
        </div>

        <div className="space-y-1">
          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Level Up!
          </span>
          <h3 id="levelup-title" className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {isMax ? `Maximallevel ${MAX_LEVEL}!` : `Level ${newLevel} erreicht!`}
          </h3>
          <p className="text-xs text-emerald-300/80">
            Glückwunsch, <strong>{player.name}</strong>! {tierChanged ? 'Du steigst auf in:' : 'Deine Rangklasse:'}
          </p>
        </div>

        <div
          className="py-2.5 px-4 rounded-xl font-bold text-sm text-stone-950 shadow-md inline-block"
          style={{ backgroundColor: tier.color }}
        >
          Rangklasse: {tier.tier}
        </div>

        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
          {isMax
            ? 'Mehr geht nicht – du hast die höchste Stufe der Liga erreicht.'
            : `Level ${oldLevel} → ${newLevel}. Weiter so – jedes gewertete Spiel bringt dir XP.`}
        </div>

        <button
          type="button"
          onClick={clearLevelModal}
          autoFocus
          className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-black text-sm shadow hover:scale-[1.02] active:scale-95 transition-all"
        >
          Weiter zocken!
        </button>
      </div>
    </div>
  );
}
