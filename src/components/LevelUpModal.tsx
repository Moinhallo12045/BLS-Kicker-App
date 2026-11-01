'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getTierForLevel } from '@/lib/levels';
import confetti from 'canvas-confetti';
import { Sparkles, Trophy, ArrowUpRight } from 'lucide-react';

export function LevelUpModal() {
  const { newLevelUnlocked, clearLevelModal } = useStore();

  useEffect(() => {
    if (newLevelUnlocked) {
      // Fire celebratory confetti bursts
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#f59e0b', '#fbbf24', '#ffffff'],
      });
      const timer = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [newLevelUnlocked]);

  if (!newLevelUnlocked) return null;

  const { player, oldLevel, newLevel } = newLevelUnlocked;
  const tier = getTierForLevel(newLevel);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="felt-card max-w-sm w-full p-6 text-center space-y-4 border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.4)] animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 p-1 shadow-lg flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-stone-950 flex items-center justify-center text-3xl">
            🏆
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Level Up!
          </span>
          <h3 className="font-display text-3xl font-extrabold text-white">
            Level {newLevel} erreicht!
          </h3>
          <p className="text-xs text-emerald-300/80">
            Glückwunsch, <strong>{player.name}</strong>! Du steigst auf in:
          </p>
        </div>

        <div 
          className="py-2.5 px-4 rounded-xl font-bold text-sm text-stone-950 shadow-md inline-block"
          style={{ backgroundColor: tier.color }}
        >
          Rangklasse: {tier.tier}
        </div>

        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
          Belohnung: Neue Abzeichen & Quests freigeschaltet!
        </div>

        <button
          onClick={clearLevelModal}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-black text-sm shadow hover:scale-[1.02] active:scale-95 transition-all"
        >
          Weiter zocken!
        </button>
      </div>
    </div>
  );
}
