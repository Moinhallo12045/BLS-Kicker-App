'use client';

import React from 'react';
import { ScrollText } from 'lucide-react';

const RELEASES = [
  {
    version: '1.1.2',
    title: 'Spielstatus auf einen Blick',
    changes: [
      'Bestätigte, strittige und annullierte Spiele in der Übersicht farblich hervorgehoben.',
      'Veralteten „Wirksam“-Filter entfernt.',
    ],
  },
  {
    version: '1.1.1',
    title: 'Persönliches Profil',
    changes: [
      'Eigenen Namen und Avatar ändern; aus 54 Emoji-Avataren wählen.',
      'Optionale „Über mich“-Beschreibung mit bis zu 160 Zeichen.',
    ],
  },
  {
    version: '1.1',
    title: 'Navigation und Spielbetrieb grundlegend überarbeitet',
    changes: [
      'Smartphone-orientierter Umbau mit unterer Hauptnavigation, gut bedienbaren Dialogen und mobilen Turnieransichten.',
      'Einzel- und Doppelturniere mit festen Teams, K.-o.-Plan und Jeder-gegen-Jeden; Ergebnisse korrigieren und Turniere zurücksetzen.',
      'Spielerprofile öffentlich ansehen, ELO-Verläufe öffnen und von Turnieren zu den zugehörigen Spielen navigieren.',
      'Spieler- und Spieldetails, Direktlinks, Browser-Zurück sowie zusammengeführte Navigation und persistente Filter für eigene Spiele, Modus und Status.',
      'Wochenrangliste im Dashboard, Funktionsübersicht der App und erweiterte, abgestufte Erfolge.',
      'Spielersuche mit zuletzt gespielten Gegnern und Partnern, Synchronisierungs-/Offline-Status sowie Hinweise auf neue Ergebnisse und offene Anfragen.',
      'Spieler mit erhaltener Spielhistorie deaktivieren; Änderungen an Ergebnissen und Löschungen im Admin-Protokoll einsehen.',
    ],
  },
  {
    version: '1.0.1',
    title: 'Liga, Turniere & Rollen',
    changes: [
      'Serverseitige Spielwertung und dauerhafte Synchronisierung von Profilen, Spielen und Turnieren.',
      'Ranglisten nach Zeitraum, Turnier und Verlauf filtern; Turniere validieren, abschließen und Sieger anzeigen.',
      'Rollen für Owner, Admins, Organisatoren und Spieler sowie Spielersperren.',
      'Extern-Status aus der bestätigten Uni-Mail ableiten.',
    ],
  },
  {
    version: '1.0.0.1',
    title: 'Bugfixes und Verbesserungen',
    changes: ['Bugfixes und technische Verbesserungen der Basisversion.'],
  },
  {
    version: '1.0',
    title: 'Liga-Grundfunktionen',
    changes: [
      'Geschlossene Registrierung mit E-Mail-Code und Spielerprofilen.',
      '1v1- und 2v2-Spiele eintragen, bestätigen und bei Rückfragen klären.',
      'Ranglisten und Spielerstatistiken mit ELO, Siegen/Niederlagen, Ligapunkten, Erfahrung, Leveln und Abzeichen.',
      'Erste Turnier- und Verwaltungsfunktionen für Spieler und Whitelist.',
    ],
  },
];

export function ChangelogView() {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-amber-400" />
          Changelog
        </h2>
        <p className="mt-1 text-sm text-emerald-200/75">
          Die Versionshistorie ist rückwirkend aus den gemergten Pull Requests gruppiert.
          Die Versionsnummern sind keine Aussage über bereits veröffentlichte Release-Tags.
        </p>
      </header>

      <div className="space-y-3">
        {RELEASES.map(({ version, title, changes }) => (
          <section key={version} className="felt-card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-lg font-black text-amber-300">{version}</span>
              <h3 className="font-display text-lg font-bold text-white">{title}</h3>
            </div>
            <ul className="mt-3 space-y-2">
              {changes.map((change) => (
                <li key={change} className="flex gap-2 text-sm leading-relaxed text-emerald-100/85">
                  <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
