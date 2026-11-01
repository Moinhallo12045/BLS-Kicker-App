export type PlayerRole = 'owner' | 'co_owner' | 'admin' | 'organiser' | 'player';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  email: string;
  yearJoined: number;
  level: number;
  xp: number;
  xpNextLevel: number;
  elo1v1: number;
  elo2v2: number;
  eloTotal: number;
  leaguePoints: number;
  wins1v1: number;
  losses1v1: number;
  wins2v2: number;
  losses2v2: number;
  currentStreak: number;
  bestRank: number;
  role: PlayerRole;
  isSuspended?: boolean;
  badges: string[]; // badge IDs
  eloHistory: { date: string; elo: number }[];
}

export type MatchMode = '1v1' | '2v2';
export type MatchStatus = 'pending' | 'confirmed' | 'disputed' | 'cancelled';

export interface Match {
  id: string;
  mode: MatchMode;
  date: string;
  creatorId: string;
  teamA: string[]; // player IDs
  teamB: string[]; // player IDs
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  confirmedBy: string[]; // player IDs who confirmed
  resultApplied?: boolean;
  disputedBy?: string;
  disputeReason?: string;
  disputeProposedScoreA?: number;
  disputeProposedScoreB?: number;
  disputeProposedBy?: string;
  eloChangeA: number; // calculated once confirmed
  eloChangeB: number;
  tournamentId?: string;
}

export type TournamentType = 'ko' | 'groups' | 'round_robin';
export type TournamentStatus = 'upcoming' | 'running' | 'completed';

export interface TournamentMatch {
  id: string;
  round: number; // 1 = Quarterfinals, 2 = Semis, etc.
  matchIndex: number;
  playerAId?: string;
  playerBId?: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  type: TournamentType;
  mode: MatchMode;
  status: TournamentStatus;
  participants: string[]; // player IDs
  createdAt: string;
  matches: TournamentMatch[];
  winnerId?: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export interface WeeklyQuest {
  id: string;
  title: string;
  rewardXp: number;
  progress: number;
  total: number;
  completed: boolean;
}

export interface InviteCode {
  code: string;
  createdBy: string;
  createdAt: string;
  usedBy?: string[];
  maxUses: number;
  isActive: boolean;
}

export interface WhitelistEntry {
  id: string;
  pattern: string; // specific email e.g. "rune@law-school.de" or domain e.g. "@law-school.de"
  addedBy: string;
  createdAt: string;
}
