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
   - **"Stimmt nicht?" / Einspruch**: Bei Unstimmigkeiten wird das Spiel als *Strittig* markiert und geht zur Prüfung an den Administrator.

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
   - Admin-Panel zum Verwalten von Einladungscodes, Auflösen strittiger Spiele und Rollenvergabe.

---

## 🛠️ Technologie-Stack (100% Kostenlos)

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide Icons, Canvas-Confetti
- **Datenbank & Auth**: Supabase (Free Tier: 500 MB Datenbank, 50.000 monatlich aktive Nutzer)
- **Hosting**: Vercel (Hobby Free Tier)
- **Offline & Demomodus**: Integrierter LocalStorage-Fallout für sofortige lokale Nutzung ohne Einrichtungsaufwand

---

## 🚀 Schnelleinstieg lokal

```bash
# Entwicklungsserver starten
npm run dev

# Im Browser öffnen:
http://localhost:3000
```

---

## ☁️ Kostenlose Bereitstellung (Supabase & Vercel)

### 1. Kostenlose Supabase Datenbank
1. Erstelle ein kostenloses Projekt auf [supabase.com](https://supabase.com).
2. Öffne den **SQL Editor** im Supabase-Dashboard.
3. Kopiere den Inhalt der Datei [`supabase/schema.sql`](file:///C:/Users/RUKAMPRO/BLS-Kicker-App/supabase/schema.sql) hinein und klicke auf **Run**.
4. Kopiere unter *Project Settings > API* deine `URL` und den `anon public key`.

### 2. Kostenloses Vercel Hosting
1. Lade das Projekt auf dein GitHub-Konto hoch.
2. Verbinde das Repository auf [vercel.com](https://vercel.com).
3. Füge in Vercel die beiden Umgebungsvariablen hinzu:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Klicke auf **Deploy**. Deine Tischkicker-Liga ist innerhalb von 1 Minute weltweit unter einer kostenlosen `.vercel.app`-Adresse erreichbar!