import { Badge, WeeklyQuest } from '@/types';

export const ALL_BADGES: Badge[] = [
  {
    id: 'stammgast_1',
    title: 'Stammgast I',
    description: '10 Ligaspiele absolviert',
    icon: '⚽',
    tier: 'bronze',
  },
  {
    id: 'siegertyp_1',
    title: 'Siegertyp I',
    description: 'Erste 5 Siege eingefahren',
    icon: '🏆',
    tier: 'bronze',
  },
  {
    id: 'revanche',
    title: 'Revanche',
    description: 'Gegen einen Gegner gewonnen, gegen den zuvor verloren wurde',
    icon: '🔄',
    tier: 'silver',
  },
  {
    id: 'eingespielt_1',
    title: 'Eingespielt I',
    description: '3 Doppelspiele mit demselben Partner gewonnen',
    icon: '🔗',
    tier: 'bronze',
  },
  {
    id: 'streak_master',
    title: 'Siegesserie',
    description: '5 Siege in Folge gefeiert',
    icon: '🔥',
    tier: 'gold',
  },
  {
    id: 'clean_sheet',
    title: 'Zu Null',
    description: 'Ein Spiel mit 10:0 oder 10:1 gewonnen',
    icon: '🛡️',
    tier: 'gold',
  },
  {
    id: 'legend_1500',
    title: 'Club 1500',
    description: 'Ein ELO-Rating von über 1.500 erreicht',
    icon: '👑',
    tier: 'diamond',
  },
  {
    id: 'turnier_champ',
    title: 'Turniersieger',
    description: 'Ein offizielles Kicker-Turnier gewonnen',
    icon: '🥇',
    tier: 'diamond',
  },
];

export const INITIAL_WEEKLY_QUESTS: WeeklyQuest[] = [
  {
    id: 'q1',
    title: 'Spiel gegen 3 verschiedene Gegner',
    rewardXp: 40,
    progress: 3,
    total: 3,
    completed: true,
  },
  {
    id: 'q2',
    title: 'Spiel 5 Partien',
    rewardXp: 50,
    progress: 5,
    total: 5,
    completed: true,
  },
  {
    id: 'q3',
    title: 'Gewinne 3 Spiele in Folge',
    rewardXp: 75,
    progress: 3,
    total: 3,
    completed: true,
  },
  {
    id: 'q4',
    title: 'Bonus: alle drei geschafft',
    rewardXp: 50,
    progress: 3,
    total: 3,
    completed: true,
  },
];
