import type { Match } from '@/types';

export function getMatchCardTone(match: Match): string {
  if (match.status === 'cancelled') return 'match-card-cancelled';
  if (match.status === 'disputed' || match.cancellationRequestedBy) return 'match-card-problem';
  if (match.status === 'confirmed') return 'match-card-confirmed';
  return 'match-card-pending';
}
