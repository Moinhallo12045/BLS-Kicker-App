import type { Match, Player } from '@/types';

export function suggestedPlayers(players: Player[], matches: Match[], actorId: string, partner: boolean) {
  const usage = new Map<string, {count: number; last: string}>();
  for (const match of matches) {
    if (match.status === 'cancelled') continue;
    const inA = match.teamA.includes(actorId);
    if (!inA && !match.teamB.includes(actorId)) continue;
    const ids = partner ? (inA ? match.teamA : match.teamB) : (inA ? match.teamB : match.teamA);
    for (const id of ids) {
      if (id === actorId) continue;
      const previous = usage.get(id);
      const date = match.createdAt || match.date;
      usage.set(id, {count: (previous?.count || 0) + 1, last: previous && previous.last > date ? previous.last : date});
    }
  }
  return [...players].sort((a, b) => {
    const first = usage.get(a.id), second = usage.get(b.id);
    return Number(Boolean(second)) - Number(Boolean(first))
      || (second?.last || '').localeCompare(first?.last || '')
      || (second?.count || 0) - (first?.count || 0)
      || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  }).map((player) => ({player, count: usage.get(player.id)?.count || 0}));
}
