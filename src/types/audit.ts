export interface AuditEntry {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  action: 'score_corrected' | 'match_cancelled' | 'player_deleted';
  targetId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}
