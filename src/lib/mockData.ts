import { Player, Match, Tournament, InviteCode, WhitelistEntry } from '@/types';

// Clean initial state without dummy data
export const INITIAL_PLAYERS: Player[] = [];

export const INITIAL_MATCHES: Match[] = [];

export const INITIAL_TOURNAMENTS: Tournament[] = [];

export const INITIAL_INVITE_CODES: InviteCode[] = [];

export const INITIAL_WHITELIST: WhitelistEntry[] = [
  {
    id: 'wl_domain',
    pattern: '@law-school.de',
    addedBy: 'system',
    createdAt: '2026-11-01',
  },
];
