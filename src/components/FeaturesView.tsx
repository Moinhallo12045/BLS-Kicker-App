'use client';

import React from 'react';
import {
  BarChart3,
  CircleHelp,
  Medal,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Dein Dashboard',
    description: 'Behalte deinen Liga-Fortschritt auf einen Blick.',
    details: ['ELO für Einzel und Doppel, Ligapunkte und Rangklasse', 'Level, Wochenaufgaben und erspielte Abzeichen', 'ELO-Verlauf und Schnellzugriff zum Spieleintrag'],
  },
  {
    icon: Trophy,
    title: 'Ranglisten',
    description: 'Finde heraus, wo du in der Liga stehst.',
    details: ['Sortierung nach ELO, Level, Aktivität und Wochenleistung', 'Getrennte Wertungen für 1v1 und 2v2', 'Krabbler-der-Woche-Filter und Bereich für neue Spieler'],
  },
  {
    icon: Swords,
    title: 'Spiele & faire Klärung',
    description: 'Trage Matches direkt ein und behalte Ergebnisse transparent im Blick.',
    details: ['Einzel oder Doppel mit Spielersuche und Torzähler', 'Ergebnisse werden sofort gewertet und für die Gegenseite markiert', 'Widerspruch, Gegenvorschlag und einvernehmliche Annullierung'],
  },
  {
    icon: Medal,
    title: 'Turniere',
    description: 'Organisiere Wettbewerbe für Einzel- und Doppel-Teams.',
    details: ['K.-o.-Plan für 2 bis 64 Teams', 'Gruppenphase und Jeder-gegen-Jeden mit automatischen Tabellen', 'Feste Doppelpaare und automatisch fortgeschriebene Runden'],
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Entdecke Spieler und vergleiche gemeinsame Duelle.',
    details: ['Durchsuchbares Spieler-Verzeichnis', 'Profile mit Wertungen, Erfolgen und Spielhistorie', 'Head-to-Head-Bilanz zweier Spieler'],
  },
  {
    icon: ShieldCheck,
    title: 'Geschützt & rollenbasiert',
    description: 'Eine geschlossene Liga mit abgestuften Verwaltungsrechten.',
    details: ['Registrierung nur mit freigeschalteter E-Mail-Adresse', 'Rollen für Owner, Co-Owner, Admin, Organiser und Player', 'Serverseitige Prüfung von Berechtigungen und Spielaktionen'],
  },
];

export function FeaturesView() {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-400" />
          Funktionen
        </h2>
        <p className="mt-1 text-sm text-emerald-200/75">
          Alles für eure Tischkicker-Liga – vom ersten Spiel bis zum Turnierfinale.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURES.map(({ icon: Icon, title, description, details }) => (
          <section key={title} className="felt-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-900/70 border border-emerald-700/50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-amber-300" />
              </span>
              <h3 className="font-bold text-white">{title}</h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-emerald-200/80">{description}</p>
            <ul className="mt-3 space-y-2">
              {details.map((detail) => (
                <li key={detail} className="flex gap-2 text-xs leading-relaxed text-slate-200/80">
                  <CircleHelp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
