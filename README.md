# ⚽ KICKER LEAGUE – Digitale Tischkicker-Liga

Eine moderne, hochwertige und mobiloptimierte Web-App (PWA) für geschlossene Tischkicker-Communitys mit ~100 Spielern. Entwickelt im authentischen Green-Felt- & Edelholz-Design nach Vorbild der BLS-Sportplattform.

---

## 🌟 Hauptfunktionen

1. **Dashboard & Spielerkarte**:
   - Begrüßung des angemeldeten Spielers mit Spielerkarte und Uni-Jahrgang
   - ELO-Rating (Einzel & Doppel getrennt sowie Gesamtwertung), Ligapunkte, Level & Rangklasse
   - Interaktiver Level-Fortschrittsbalken (1 bis 50 Level) mit Konfetti-Animation bei Level-Aufstieg
   - **Aufgaben der Woche** mit XP-Belohnungen
   - **Abzeichen-Karussell** ("7 von 47")
   - **Elo-Verlauf** interaktiver Chart (1 Woche, 1 Monat, Alles)
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
   - **K.-o.-Turnier**: Interaktiver visueller Turnierbaum mit Viertelfinale, Halbfinale, Finale und automatischem Weiterkommen der Sieger nach Ergebniseingabe.
   - **Gruppenphase & Jeder-gegen-Jeden**: Automatische Tabellenberechnung mit Siegen, Niederlagen, Toren und Punkten.
   - Turnierleitungswerkzeug zum Erstellen neuer Turniere.

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
- **Offline & Demomodus**: Integrierter LocalStorage-Fallback für sofortige Nutzung ohne Einrichtungsaufwand

### Datenbank und Migrationen

- Supabase-Migrationen liegen unter [`supabase/migrations`](supabase/migrations).
- Der GitHub-Actions-Workflow [`supabase-migrate.yml`](.github/workflows/supabase-migrate.yml) spielt neue Migrationen automatisch auf das verknüpfte Projekt ein.
- Die produktive Autorisierung erfolgt serverseitig über Supabase-RLS, Trigger und Security-Definer-Funktionen; Client-Zustände oder LocalStorage vergeben keine Rechte.
- Match-RPCs lehnen gesperrte Spieler, unbekannte Profile und doppelte Spieler-IDs in Teams serverseitig ab.
- Beim Löschen, Annullieren oder Korrigieren gewerteter Spiele werden ELO (inklusive nachfolgender Spielwertungen), Ligapunkte, Bilanzen, XP, Level, Siegesserie und ELO-Verlauf chronologisch aus den verbleibenden gewerteten Spielen neu aufgebaut. Strittige, bereits gewertete Spiele zählen bis zur Annullierung weiter; ungewertete Spiele zählen nicht.
- Die Migration `20261101210000_rebuild_match_stats_on_removal.sql` repariert bestehende Statistiken einmalig und übernimmt ältere bestätigte bzw. mit ELO-Änderungen gespeicherte Spiele als gewertet. Ausgangswerte sind ELO 1000 je Modus, Level 1 und 0 XP (erste Levelschwelle: 150 XP); manuell gesetzte Statistikwerte werden ersetzt, Rollen und Abzeichen bleiben unverändert.
- Für eine leere Übergabe-Datenbank nur Datensätze löschen, niemals Tabellen, RLS oder Funktionen. Owner-Mail und erlaubte Domain anschließend in der Whitelist hinterlegen und die Owner-Rolle einmalig serverseitig setzen.

Die SQL-Regressionen laufen auf einer **leeren, wegwerfbaren PostgreSQL-Datenbank** mit einem Superuser (nicht auf Supabase/Produktion):

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/match_stats_bootstrap.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/match_stats_removal.sql
```

Der Bootstrap simuliert Supabase-Auth und spielt Schema sowie bisherige Migrationen ein. Der Regressionstest legt Altdaten an, wendet die neue Migration an und prüft Annullierung, Mehrfachlöschung, Ergebnisänderungen, Berechtigungen und Levelgrenzen.

Die Folgemigration `20261101213500_rebuild_match_achievements.sql` bereinigt zusätzlich die sieben spielabhängigen Abzeichen und die beste Platzierung. Beim chronologischen Neuaufbau werden erreichte Erfolge erneut vergeben; ein später verlorenes Spiel entfernt einen früher weiterhin belegten Erfolg nicht. Die beste Platzierung folgt der Gesamt-ELO-Rangliste ab drei Spielen. Turnier-Abzeichen und unbekannte/manuelle Abzeichen bleiben erhalten, ebenso persönliche Profildaten. Neue Spielwertungen aktualisieren diese Erfolge ebenfalls. Zusätzlicher Regressionstest nach den obigen Befehlen:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/match_achievements.sql
```

### Sicherheitsstatus

- RLS ist für Profile, Matches, Turniere, Einladungscodes und Whitelist aktiviert.
- Match-, Profil- und Sperrlogik wird serverseitig über geschützte RPCs und Trigger validiert.
- Anonyme Ausführung der mutierenden RPCs ist entzogen; reine Trigger-Funktionen sind nicht direkt ausführbar.
- Die Supabase-Advisor-Warnungen zu authentifizierten `SECURITY DEFINER`-RPCs sind für die von der Anwendung benötigten eingeloggten Aufrufe erwartbar.
- Die Authentifizierung nutzt OTP/Magic-Link; es werden keine Benutzerpasswörter benötigt.
- Nach jeder Migration sollte der Supabase Security/Performance Advisor erneut ausgeführt werden. Ein Live-Penetrationstest und die Prüfung der Dashboard-/Projektkonfiguration sind nicht durch den Quellcode ersetzt.

---

## 🚀 Schnelleinstieg lokal

```bash
# Entwicklungsserver starten
npm run dev

# Im Browser öffnen:
http://localhost:3000
```

---

## 🌐 Bereitstellung über GitHub Pages (100% Kostenlos)

Die Anwendung ist für den statischen Export auf GitHub Pages konfiguriert und enthält bereits den automatischen GitHub Actions Workflow [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml).

### 1. GitHub Pages im Repository aktivieren
1. Gehe auf GitHub in dein Repository `https://github.com/Moinhallo12045/BLS-Kicker-App`.
2. Klicke auf **Settings** > **Pages** (in der linken Seitenleiste).
3. Wähle unter **Build and deployment > Source**: **GitHub Actions** aus.

### 2. Live schalten
1. Sobald du deine Änderungen in den `main`-Branch pushst (`git push origin main`), startet der GitHub Action Workflow automatisch.
2. Nach ca. 1 Minute ist die Liga unter folgendem Link live:
   👉 **`https://moinhallo12045.github.io/BLS-Kicker-App/`**