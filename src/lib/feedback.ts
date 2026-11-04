export function friendlyError(error: unknown, fallback = 'Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.'): string {
  const message = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message : '';
  if (/requires a WHERE clause/i.test(message)) {
    return 'Die Datenbank hat die Änderung zum Schutz der Daten blockiert. Bitte die Administration informieren.';
  }
  if (/failed to fetch|fetch failed|network|load failed|offline/i.test(message)) {
    return 'Keine Verbindung zum Server. Bitte die Internetverbindung prüfen und erneut versuchen.';
  }
  if (/permission denied|not permitted|not allowed|denied|administrator required|not a participant|agreement.*required/i.test(message)) {
    return 'Du hast keine Berechtigung für diese Änderung. Bitte die Administration kontaktieren.';
  }
  if (/jwt|token.*expired|session.*expired|not authenticated/i.test(message)) {
    return 'Deine Anmeldung ist abgelaufen. Bitte erneut anmelden.';
  }
  if (/linked nonsuspended|suspended players/i.test(message)) {
    return 'Ein aktives Spielerprofil ist erforderlich. Bitte die Administration kontaktieren.';
  }
  if (/not found/i.test(message)) return 'Der Eintrag ist nicht mehr vorhanden. Bitte die Daten aktualisieren.';
  if (/duplicate key|unique constraint/i.test(message)) return 'Dieser Eintrag existiert bereits. Bitte die Daten aktualisieren.';
  if (/foreign key/i.test(message)) return 'Der Eintrag ist noch mit anderen Daten verknüpft und kann nicht entfernt werden.';
  if (/timeout|timed out|canceling statement/i.test(message)) return 'Der Server antwortet zu langsam. Bitte kurz warten und erneut versuchen.';
  if (/invalid player details/i.test(message)) return 'Die Profildaten sind ungültig. Bitte die Administration kontaktieren.';
  if (/invalid.*score|invalid.*match|invalid.*dispute/i.test(message)) return 'Die Spielangaben sind ungültig. Bitte Spieler und Ergebnis prüfen.';
  if (/^[A-ZÄÖÜ][^;\n]*[.!?]?$/.test(message) && /[äöüß]|\b(Bitte|Spieler|Spiel|Profil|Die|Der|Dein|Diese|Keine|Nicht|Ungültig|Nur|Eintrag|Rolle|Code|Gelöschte)\b/.test(message)) {
    return message;
  }
  return fallback;
}
