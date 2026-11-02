# ⚽ KICKER LEAGUE – Digitale Tischkicker-Liga

Eine moderne, hochwertige und mobiloptimierte Web-App (PWA) für geschlossene Tischkicker-Communitys mit ~100 Spielern. Entwickelt im authentischen Green-Felt- & Edelholz-Design nach Vorbild der BLS-Sportplattform.

---

## 🌟 Hauptfunktionen

1. **Dashboard & Spielerkarte**:
   - Begrüßung des angemeldeten Spielers mit Spielerkarte und Uni-Jahrgang
   - ELO-Rating (Einzel & Doppel getrennt sowie Gesamtwertung), Ligapunkte, Level & Rangklasse
   - Interaktiver Level-Fortschrittsbalken (1 bis 50 Level) mit Konfetti-Animation bei Level-Aufstieg
   - **Aufgaben der Woche** mit echtem Fortschritt aus gewerteten Spielen (keine zusätzlichen XP-Belohnungen)
   - **Abzeichen-Karussell** mit tatsächlich erspielten Erfolgen
   - **Elo-Verlauf** aus gespeicherten Wertungen (1 Woche, 1 Monat, Alles)
   - Schnellzugriff zum Eintragen neuer Spiele

2. **Ranglisten-System**:
   - Filter nach **Elo**, **Wochenzocker**, **Level**, **Aktivität**, **Einzel (1v1)** und **Doppel (2v2)**
   - Medaillen im Lorbeerkranz-Design (Gold, Silber, Bronze, Smaragd)
   - Anzeige des frei wählbaren Uni-Jahrgangs, Siegesserien-Flammen (🔥) und ELO-Gewinn
   - **Krabbler-der-Woche-Leaderboard** für 0:…-Niederlagen der laufenden Woche
   - Spezieller Bereich *"Neu dabei – In der Elo-Rangliste ab 3 Spielen"* für Einsteiger

3. **Spieleintrags- & Widerspruchsworkflow**:
   - Umschalten zwischen **1 gegen 1** und **2 gegen 2**
   - Interaktive Teamauswahl (*Ich*, *+ Partner*, *+ Gegner 1*, *+ Gegner 2*)
   - Spieler-Schnellauswahl mit Suchfeld
   - Torzähler bis 10 Tore inklusive Presets (10:7, 10:5, 10:8, 10:0, ...)
   - **Sofort wirksam**: Das eingetragene Ergebnis wird unmittelbar gewertet. Die Gegenseite erhält unter *"Neu für dich"* eine Benachrichtigung.
   - **Widerspruch statt Freigabe**: Die Gegenseite kann das Ergebnis als gesehen markieren oder widersprechen. Nur widersprochene Spiele werden als strittig behandelt.
   - **Direkte Einigung**: Bei einem Widerspruch kann ein Gegenvorschlag gemacht und von der Gegenseite angenommen werden; alternativ kann das Spiel im gegenseitigen Einvernehmen gestrichen oder administrativ entschieden werden.

4. **Turniermodus**:
   - **Einzel und Doppel**: 1v1 oder 2v2 mit zwei festen Spielern je Team; niemand darf mehreren Teams angehören.
   - **K.-o.-Turnier**: 2, 4, 8, 16, 32 oder 64 Teams, vertikaler Smartphone-Spielplan und automatisches Weiterkommen der Sieger.
   - **Gruppenphase & Jeder-gegen-Jeden**: Automatische Tabellenberechnung mit Siegen, Niederlagen, Toren und Punkten.
   - Turniere, feste Paarungen und Ergebnisse werden bei konfiguriertem Supabase auf dem Server gespeichert.
   - Ergebniskorrekturen ersetzen das verknüpfte Ligaspiel und setzen abhängige K.-o.-Runden, Sieger und deren Statistiken zurück. Beide Spieler des Siegerteams erhalten das Turnierabzeichen.
   - Alte Doppelturniere ohne gespeicherte feste Paare bleiben schreibgeschützt und müssen neu angelegt werden.

5. **Spieler-Community & Head-to-Head Duelle**:
   - Spieler-Verzeichnis mit Suche nach Namen
   - Direkter Duell-Vergleich (*Head-to-Head*): Bilanz zweier Spieler, gemeinsame Spiele und Tore.

6. **Geschlossenes Registrierungs- & Rechtesystem**:
   - Registrierung nur für E-Mail-Adressen oder Domains auf der serverseitigen Whitelist.
   - Rollensystem: **Owner**, **Co-Owner**, **Admin**, **Organiser**, **Player**.
   - **Owner**: vollständige Verwaltung und Ernennung von Co-Ownern, Admins, Organisern und Playern.
   - **Co-Owner**: Server-Admin-Rechte für andere Accounts und Verwaltungsdaten, aber keine Bearbeitung der eigenen Rolle, des Owners oder Vergabe der Owner-Rolle.
   - **Admin**: Whitelist, Einladungscodes und Moderation; keine Rollenänderungen.
   - **Organiser**: Turniere und Turniermatches; keine Rollen- oder Whitelistverwaltung.
   - **Player**: eigene Profil- und Spielfunktionen.

---

## 🛠️ Technologie-Stack (100% Kostenlos)

- **Frontend**: Next.js (Static Export), React, Tailwind CSS, Lucide Icons, Canvas-Confetti
- **Hosting**: GitHub Pages (Kostenlos über GitHub Actions)
- **Datenbank & Auth**: Supabase (Free Tier: 500 MB Datenbank, 50.000 monatlich aktive Nutzer)
- **Lokaler Demomodus**: Ohne Supabase-Konfiguration werden vorhandene lokale Spieler, Spiele und Turniere genutzt. Bei konfiguriertem Supabase gibt es keinen lokalen Ersatz für fehlgeschlagene Serveraktionen.

### Smartphone und Synchronisierung

Die Hauptnavigation liegt am unteren Bildschirmrand; große Bedienelemente, Safe-Area-Abstände, scrollbare Dialoge und erlaubter Pinch-Zoom unterstützen kleine Displays. Serverdaten werden nach Änderungen, beim Zurückkehren zur App und alle 15 Sekunden bei sichtbarer Seite aktualisiert. Listen werden in Seiten von 250 Datensätzen vollständig geladen. Speicher- und Synchronisierungsfehler werden angezeigt; laufende Schreibaktionen sind gegen doppelte Übermittlung geschützt.

### Datenbank und Migrationen

- Supabase-Migrationen liegen unter [`supabase/migrations`](supabase/migrations).
- Der GitHub-Actions-Workflow [`supabase-migrate.yml`](.github/workflows/supabase-migrate.yml) spielt neue Migrationen automatisch auf das verknüpfte Projekt ein.
- Die produktive Autorisierung erfolgt serverseitig über Supabase-RLS, Trigger und Security-Definer-Funktionen; Client-Zustände oder LocalStorage vergeben keine Rechte.
- Match-RPCs lehnen gesperrte Spieler, unbekannte Profile und doppelte Spieler-IDs in Teams serverseitig ab.
- Profilanlage, Rollenwechsel, Sperren, Moderation und Turnierwertung laufen über autorisierte RPCs. Direkte Client-Schreibzugriffe können weder Statistikwerte noch Auth-Verknüpfung, Rolle oder Sperrstatus manipulieren.
- Öffentliche Profillisten enthalten keine E-Mail-Adressen oder Auth-Benutzer-IDs. Das eigene Profil wird über `get_my_profile()` bestimmt.
- Ein Auth-Konto ist noch kein Spielerprofil: Erst das Absenden des Profilformulars legt über `create_player_profile` einen Eintrag in `public.profiles` an. Ein leeres Ergebnis von `get_my_profile()` (auch ein Objekt mit NULL-Feldern) wird nicht als Spieler übernommen; die Profileinrichtung bleibt verfügbar.
- ELO verwendet K=32 ohne Torabstandsbonus; die Gesamtwertung ist der gerundete Mittelwert beider Modi. Ein Spiel gibt 25 XP, ein Sieg zusätzlich 50 XP und 3 Ligapunkte. Level 1 benötigt 150 XP, danach gilt `100 + Level * 25`, maximal Level 50.
- Beim Löschen, Annullieren oder Korrigieren gewerteter Spiele werden ELO (inklusive nachfolgender Spielwertungen), Ligapunkte, Bilanzen, XP, Level, Siegesserie und ELO-Verlauf chronologisch aus den verbleibenden gewerteten Spielen neu aufgebaut. Strittige, bereits gewertete Spiele zählen bis zur Annullierung weiter; ungewertete Spiele zählen nicht.
- Die Migration `20261101210000_rebuild_match_stats_on_removal.sql` repariert bestehende Statistiken einmalig und übernimmt ältere bestätigte bzw. mit ELO-Änderungen gespeicherte Spiele als gewertet. Ausgangswerte sind ELO 1000 je Modus, Level 1 und 0 XP (erste Levelschwelle: 150 XP); manuell gesetzte Statistikwerte werden ersetzt, Rollen und Abzeichen bleiben unverändert.
- Für eine leere Übergabe-Datenbank nur Datensätze löschen, niemals Tabellen, RLS oder Funktionen. Owner-Mail und erlaubte Domain anschließend in der Whitelist hinterlegen und die Owner-Rolle einmalig serverseitig setzen.

Die SQL-Regressionen laufen auf einer **leeren, wegwerfbaren PostgreSQL-Datenbank** mit einem Superuser (nicht auf Supabase/Produktion):

```bash
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/regression bash scripts/test-database.sh
```

Der Runner prüft die historischen Statistik-Migrationen, den vollständigen aktuellen Stand und das Upgrade einer befüllten Datenbank in drei getrennten Datenbanken. Zwei zusätzliche Testdatenbanken werden angelegt und anschließend entfernt; die angegebene Datenbank muss ebenfalls wegwerfbar sein. Abgedeckt sind direkte Manipulationsversuche, Whitelist und Profilanlage, Rollen/Sperren, gegenseitige Annullierung, feste Doppelpaare, Turnierkorrekturen, Abzeichen und Replay-Parität. Ein Skalierungstest enthält 1.000 und 2.000 Spiele.

Die Folgemigration `20261101213500_rebuild_match_achievements.sql` bereinigt zusätzlich die sieben spielabhängigen Abzeichen und die beste Platzierung. Beim chronologischen Neuaufbau werden erreichte Erfolge erneut vergeben; ein später verlorenes Spiel entfernt einen früher weiterhin belegten Erfolg nicht. Die beste Platzierung folgt der Gesamt-ELO-Rangliste ab drei Spielen. Turnier-Abzeichen und unbekannte/manuelle Abzeichen bleiben erhalten, ebenso persönliche Profildaten. Neue Spielwertungen aktualisieren diese Erfolge ebenfalls.

Die Migrationen `20261101220000` bis `20261101224000` härten die Client-Verträge, ergänzen persistente feste Turnierteams und gemeinsame autorisierte RPCs und beschleunigen den Replay durch zwischengespeicherte Spielerzustände. Turnierabzeichen folgen nun ebenfalls den aktuell gültigen Turniersiegern; manuelle und unbekannte Abzeichen bleiben erhalten.

### Sicherheitsstatus

- RLS ist für Profile, Matches, Turniere, Einladungscodes und Whitelist aktiviert.
- Match-, Profil- und Sperrlogik wird serverseitig über geschützte RPCs und Trigger validiert.
- Anonyme Ausführung der mutierenden RPCs ist entzogen; reine Trigger-Funktionen sind nicht direkt ausführbar.
- Die Supabase-Advisor-Warnungen zu authentifizierten `SECURITY DEFINER`-RPCs sind für die von der Anwendung benötigten eingeloggten Aufrufe erwartbar.
- Die Authentifizierung nutzt OTP/Magic-Link; es werden keine Benutzerpasswörter benötigt.
- Einladungscodes umgehen die Whitelist nicht. Eine neue Registrierung erfolgt ausschließlich über freigegebene E-Mail und OTP.
- `is_email_whitelisted` ist nicht direkt durch Clients aufrufbar. Die Profilanlage prüft die Whitelist intern; Owner, Co-Owner und Admins verwalten sie weiterhin über die autorisierten Verwaltungs-RPCs. Bestehende Projekte erhalten diese Einschränkung durch die Migration `20261102123000_restrict_whitelist_check_rpc.sql`.
- Next.js ist auf eine gepatchte Version aktualisiert. `npm audit --omit=dev` meldet keine bekannten Schwachstellen; im Entwicklungs-Lint-Tooling bleiben 16 moderate Meldungen wegen einer transitiven `minimatch`-Abhängigkeit. Eine inkompatible Major-Version wird nicht erzwungen.
- GitHub Pages erlaubt hier keine frei konfigurierbaren HTTP-Sicherheitsheader; die unterstützte Content-Security-Policy ist gesetzt, ersetzt aber keine Prüfung der Hosting-Konfiguration.
- Nach jeder Migration sollte der Supabase Security/Performance Advisor erneut ausgeführt werden. Ein Live-Penetrationstest und die Prüfung der Dashboard-/Projektkonfiguration sind nicht durch den Quellcode ersetzt.

---

## 🚀 Schnelleinstieg lokal

```bash
npm ci
# Entwicklungsserver starten
npm run dev

# Im Browser öffnen:
http://localhost:3000
```

Frontend-Prüfungen: `npm run lint`, `npm run typecheck`, `npm test` und `npm run build`. Der Workflow `.github/workflows/check.yml` führt sie zusammen mit den PostgreSQL-Regressionen bei Pull Requests und Pushes auf `main` aus.

---

## 🌐 Bereitstellung über GitHub Pages (100% Kostenlos)

Die Anwendung ist für den statischen Export auf GitHub Pages konfiguriert und enthält bereits den automatischen GitHub Actions Workflow [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml).

### 1. GitHub Pages im Repository aktivieren
1. Gehe auf GitHub in dein Repository `https://github.com/Moinhallo12045/BLS-Kicker-App`.
2. Klicke auf **Settings** > **Pages** (in der linken Seitenleiste).
3. Wähle unter **Build and deployment > Source**: **GitHub Actions** aus.

### 2. Live schalten
1. Sobald Änderungen nach `main` gelangen, starten die Workflows automatisch. Der Migrationsworkflow prüft bei jedem Push idempotent den Datenbankstand; Migrationsläufe werden nicht gegenseitig abgebrochen.
2. Die Veröffentlichung wartet auf den erfolgreichen Migrationslauf desselben Commits. Bei einem Fehler wird keine inkompatible neue App veröffentlicht.
3. Danach ist die Liga unter folgendem Link live:
   👉 **`https://moinhallo12045.github.io/BLS-Kicker-App/`**