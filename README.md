# ⚽ KICKER LEAGUE – Digitale Tischkicker-Liga

Eine moderne, hochwertige und mobiloptimierte Web-App (PWA) für geschlossene Tischkicker-Communitys mit ~100 Spielern. Entwickelt im authentischen Green-Felt- & Edelholz-Design nach Vorbild der BLS-Sportplattform.

---

## 🌟 Hauptfunktionen

1. **Dashboard & Spielerkarte**:
   - Begrüßung des angemeldeten Spielers (standardmäßig *Birk*, frei wechselbar)
   - ELO-Rating (Einzel & Doppel getrennt sowie Gesamtwertung), Ligapunkte, Level & Rangklasse
   - Interaktiver Level-Fortschrittsbalken (1 bis 50 Level) mit Konfetti-Animation bei Level-Aufstieg
   - **Aufgaben der Woche** mit XP-Belohnungen
   - **Abzeichen-Karussell** ("7 von 47")
   - **Elo-Verlauf** interaktiver Chart (1 Woche, 1 Monat, Alles)
   - Schnellzugriff zum Eintragen neuer Spiele

2. **Ranglisten-System**:
   - Filter nach **Elo**, **Wochenzocker**, **Level**, **Aktivität**, **Einzel (1v1)** und **Doppel (2v2)**
   - Medaillen im Lorbeerkranz-Design (Gold, Silber, Bronze, Smaragd)
   - Jahrgangsanzeige (z.B. Jg. 2022, 2025), Siegesserien-Flammen (🔥) und ELO-Gewinn
   - Spezieller Bereich *"Neu dabei – In der Elo-Rangliste ab 3 Spielen"* für Einsteiger

3. **Spieleintrags- & Bestätigungsworkflow**:
   - Umschalten zwischen **1 gegen 1** und **2 gegen 2**
   - Interaktive Teamauswahl (*Ich*, *+ Partner*, *+ Gegner 1*, *+ Gegner 2*)
   - Spieler-Schnellauswahl mit Suchfeld
   - Torzähler bis 10 Tore inklusive Presets (10:7, 10:5, 10:8, 10:0, ...)
   - **Bestätigungspflicht**: Die Gegenseite erhält eine Anfrage unter *"Neu für dich"*. Erst nach Bestätigung erfolgt die offizielle serverseitige ELO-Berechnung.
   - **"Stimmt nicht?" / Einigung unter den Spielern**:
     Bei Unstimmigkeiten wird das Spiel nicht über einen Admin eskaliert, sondern direkt zwischen den beteiligten Spielern geklärt:
     1. Der beanstandende Spieler gibt das aus seiner Sicht korrekte Ergebnis (z.B. 8:10) und einen Kommentar ein.
     2. Die Gegenseite sieht diesen Gegenvorschlag unter *"Neu für dich"* oder im Reiter *"Spiele"*.
     3. Sie kann den Gegenvorschlag mit einem Klick annehmen (Ergebnis wird sofort offiziell gewertet & ELO aktualisiert) oder das Spiel im gegenseitigen Einvernehmen streichen.

4. **Turniermodus**:
   - **K.-o.-Turnier**: Interaktiver visueller Turnierbaum mit Viertelfinale, Halbfinale, Finale und automatischem Weiterkommen der Sieger nach Ergebniseingabe.
   - **Gruppenphase & Jeder-gegen-Jeden**: Automatische Tabellenberechnung mit Siegen, Niederlagen, Toren und Punkten.
   - Turnierleitungswerkzeug zum Erstellen neuer Turniere.

5. **Spieler-Community & Head-to-Head Duelle**:
   - Spieler-Verzeichnis mit Suche nach Namen
   - Direkter Duell-Vergleich (*Head-to-Head*): Bilanz zweier Spieler, gemeinsame Spiele und Tore.

6. **Geschlossenes Registrierungs- & Rechtesystem**:
   - Kein anonymer Zugang: Registrierung ausschließlich mit Einladungscode (z.B. `KICKER2026`).
   - Rollensystem: **Administrator**, **Turnierleitung**, **Spieler**.
   - Admin-Panel zum Verwalten von Einladungscodes und Rollenvergabe.

---

## 🛠️ Technologie-Stack (100% Kostenlos)

- **Frontend**: Next.js (Static Export), React, Tailwind CSS, Lucide Icons, Canvas-Confetti
- **Hosting**: GitHub Pages (Kostenlos über GitHub Actions)
- **Datenbank & Auth**: Supabase (Free Tier: 500 MB Datenbank, 50.000 monatlich aktive Nutzer)
- **Offline & Demomodus**: Integrierter LocalStorage-Fallback für sofortige Nutzung ohne Einrichtungsaufwand

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