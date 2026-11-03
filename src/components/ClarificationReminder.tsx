'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import { getActionableMatches, isOpposingSide } from '@/lib/matchViews';

export function ClarificationReminder({onOpen}: {onOpen: () => void}) {
  const {matches, currentUser} = useStore();
  if (!currentUser) return null;
  const actionable = getActionableMatches(matches, currentUser.id);
  const proposals = actionable.disputed.filter((match) => match.disputeProposedScoreA !== undefined
    && match.disputeProposedScoreB !== undefined && isOpposingSide(match,currentUser.id,match.disputeProposedBy));
  const count = actionable.pending.length + proposals.length + actionable.cancellations.length;
  if (!count) return null;
  const parts = [
    actionable.pending.length ? `${actionable.pending.length} ungesehene Ergebnisse` : '',
    proposals.length ? `${proposals.length} Gegenvorschläge zur Annahme` : '',
    actionable.cancellations.length ? `${actionable.cancellations.length} Streichungsanfragen` : '',
  ].filter(Boolean);
  return <button type="button" onClick={onOpen}
    className="w-full mb-4 p-3 rounded-xl border border-amber-500/50 bg-amber-950/40 text-left text-amber-200">
    <span className="block text-sm font-bold">Deine Rückmeldung ist gefragt ({count})</span>
    <span className="block text-xs mt-1">{parts.join(' · ')} – jetzt ansehen</span>
  </button>;
}
