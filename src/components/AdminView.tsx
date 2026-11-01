'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { ShieldCheck, AlertTriangle, Key, Users, Check, X, Edit2, Trash2, Mail, Plus } from 'lucide-react';
import { PlayerRole } from '@/types';

export function AdminView() {
  const { 
    currentUser, 
    players, 
    matches, 
    inviteCodes, 
    createInviteCode, 
    adminResolveDispute,
    whitelist,
    addWhitelistEntry,
    removeWhitelistEntry,
    updatePlayerRole
  } = useStore();

  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState(50);
  const [newWhitelistPattern, setNewWhitelistPattern] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Dispute resolution form state
  const [resolvingMatchId, setResolvingMatchId] = useState<string | null>(null);
  const [customScoreA, setCustomScoreA] = useState(10);
  const [customScoreB, setCustomScoreB] = useState(8);

  const disputedMatches = matches.filter((m) => m.status === 'disputed');

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const res = createInviteCode(newCode, maxUses);
    setNotification(res.message);
    setNewCode('');
    setTimeout(() => setNotification(null), 3000);
  };

  if (!currentUser || ['owner', 'co_owner', 'admin'].includes(currentUser.role) === false) {
    return (
      <div className="p-8 text-center felt-card space-y-3 border-red-800/40">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Zugriff verweigert</h2>
        <p className="text-sm text-stone-400">
          Dieser Bereich ist ausschließlich Administratoren der BLS Kicker League vorbehalten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-400" />
          Administrator-Bereich
        </h2>
        <p className="text-xs text-emerald-300/80">
          Zentrale Verwaltung von Einladungscodes, strittigen Spielen und Spielerrollen
        </p>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-600 text-xs font-semibold text-emerald-200">
          {notification}
        </div>
      )}

      {/* 1. Strittige Spiele (Dispute Arbitration) */}
      <div className="felt-card p-5 space-y-4 border-amber-600/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Strittige Spiele ({disputedMatches.length})
            </h3>
            <p className="text-[11px] text-emerald-300/80 mt-0.5">
              Strittige Spiele werden primär direkt zwischen den beiden Spielern einvernehmlich gelöst.
            </p>
          </div>
        </div>

        {disputedMatches.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 text-center text-xs text-emerald-300/60">
            Aktuell liegen keine offenen Einwände vor. Alle Spiele sind einvernehmlich gewertet.
          </div>
        ) : (
          <div className="space-y-3">
            {disputedMatches.map((m) => {
              const teamAPlayers = m.teamA.map((id) => getPlayer(id)).filter(Boolean);
              const teamBPlayers = m.teamB.map((id) => getPlayer(id)).filter(Boolean);
              const disputer = getPlayer(m.disputedBy || '');

              const isResolving = resolvingMatchId === m.id;

              return (
                <div key={m.id} className="p-4 rounded-xl bg-red-950/30 border border-red-700/50 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{m.date} ({m.mode})</span>
                    <span className="text-red-400 font-bold uppercase text-[10px]">
                      Strittig gemeldet von {disputer?.name || 'Gegner'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-stone-950/60 p-3 rounded-lg border border-red-900/40">
                    <div className="text-xs font-bold text-amber-300">
                      {teamAPlayers.map((p) => p?.name).join(' & ')}
                    </div>
                    <div className="font-mono text-lg font-black text-white">
                      {m.scoreA} : {m.scoreB}
                    </div>
                    <div className="text-xs font-bold text-amber-300">
                      {teamBPlayers.map((p) => p?.name).join(' & ')}
                    </div>
                  </div>

                  {m.disputeReason && (
                    <div className="text-xs text-stone-300 p-2 rounded bg-stone-900/80 border border-stone-800">
                      <strong>Begründung:</strong> {m.disputeReason}
                    </div>
                  )}

                  {!isResolving ? (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => adminResolveDispute(m.id, 'cancel')}
                        className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-bold border border-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Spiel annullieren
                      </button>

                      <button
                        onClick={() => {
                          setResolvingMatchId(m.id);
                          setCustomScoreA(m.scoreA);
                          setCustomScoreB(m.scoreB);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Ergebnis korrigieren & werten
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-stone-900 border border-amber-500/60 space-y-3">
                      <div className="text-xs font-bold text-amber-300">
                        Korrigiertes amtliches Ergebnis festlegen:
                      </div>
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <span className="text-[10px] text-emerald-400 block mb-1">
                            Team A Tore
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={customScoreA}
                            onChange={(e) => setCustomScoreA(parseInt(e.target.value) || 0)}
                            className="w-14 h-10 text-center font-mono text-xl font-bold bg-stone-950 border border-emerald-600 rounded-lg text-white"
                          />
                        </div>

                        <span className="font-bold text-white text-xl">:</span>

                        <div className="text-center">
                          <span className="text-[10px] text-emerald-400 block mb-1">
                            Team B Tore
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={customScoreB}
                            onChange={(e) => setCustomScoreB(parseInt(e.target.value) || 0)}
                            className="w-14 h-10 text-center font-mono text-xl font-bold bg-stone-950 border border-emerald-600 rounded-lg text-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResolvingMatchId(null)}
                          className="px-3 py-1 text-xs text-stone-300 hover:text-white"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={() => {
                            adminResolveDispute(m.id, 'confirm', customScoreA, customScoreB);
                            setResolvingMatchId(null);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow"
                        >
                          Ergebnis bestätigen & ELO berechnen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Geschlossene Registrierung & Einladungscodes */}
      <div className="felt-card p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            Einladungscodes verwalten
          </h3>
          <p className="text-xs text-emerald-300/80">
            Da die Kicker League eine geschlossene Community ist, ist eine Registrierung nur mit gültigem Code möglich.
          </p>
        </div>

        {/* Code Generator Form */}
        <form onSubmit={handleCreateCode} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            required
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Neuer Code (z.B. SOMMER-LIGA)"
            className="flex-1 bg-emerald-950/80 border border-emerald-800 rounded-xl px-3 py-2 text-xs text-white uppercase placeholder-emerald-400/50 focus:outline-none focus:border-amber-400 font-mono font-bold"
          />
          <input
            type="number"
            min="1"
            max="500"
            value={maxUses}
            onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
            className="w-24 bg-emerald-950/80 border border-emerald-800 rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-amber-400"
            title="Maximale Nutzungen"
          />
          <button
            type="submit"
            className="py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow"
          >
            Code anlegen
          </button>
        </form>

        {/* Existing Codes List */}
        <div className="divide-y divide-emerald-900/30">
          {inviteCodes.map((c) => (
            <div key={c.code} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-amber-300 bg-stone-900 px-2 py-0.5 rounded border border-amber-600/40">
                  {c.code}
                </span>
                <span className="text-[10px] text-emerald-400/60 ml-2">
                  Erstellt am {c.createdAt}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-emerald-200">
                  {c.usedBy?.length || 0} / {c.maxUses}
                </span>
                <span className="text-[10px] text-emerald-400/60 ml-1">eingelöst</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. E-Mail Whitelist (Zugangsberechtigungen) */}
      <div className="felt-card p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            E-Mail Whitelist ({whitelist.length} Einträge)
          </h3>
          <p className="text-xs text-emerald-300/80">
            Nur Spieler mit diesen E-Mail-Adressen oder Domains erhalten einen Verifikationscode.
          </p>
        </div>

        {/* Add Whitelist Pattern Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newWhitelistPattern.trim()) return;
            const res = await addWhitelistEntry(newWhitelistPattern);
            setNotification(res.message);
            if (res.success) setNewWhitelistPattern('');
            setTimeout(() => setNotification(null), 3000);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            required
            value={newWhitelistPattern}
            onChange={(e) => setNewWhitelistPattern(e.target.value.toLowerCase())}
            placeholder="z.B. @law-school.de oder gast@partner.de"
            className="flex-1 bg-emerald-950/80 border border-emerald-800 rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-400/50 focus:outline-none focus:border-amber-400 font-mono"
          />
          <button
            type="submit"
            className="py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Freischalten
          </button>
        </form>

        {/* Whitelist List */}
        <div className="divide-y divide-emerald-900/30 max-h-48 overflow-y-auto pr-1">
          {whitelist.map((w) => (
            <div key={w.id} className="py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700/50">
                  {w.pattern}
                </span>
                <span className="text-[10px] text-emerald-400/60">
                  {w.pattern.startsWith('@') ? 'Ganze Domain' : 'Einzelne E-Mail'}
                </span>
              </div>
              <button
                onClick={async () => {
                  const res = await removeWhitelistEntry(w.id);
                  setNotification(res.message);
                  setTimeout(() => setNotification(null), 3000);
                }}
                className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40"
                title="Von Whitelist entfernen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Spieler & Rollen Übersicht */}
      <div className="felt-card p-5 space-y-4">
        <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Spieler-Rollen ({players.length} Spieler)
        </h3>

        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {players.map((p) => (
            <div
              key={p.id}
              className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span>{p.avatar}</span>
                <span className="font-bold text-white">{p.name}</span>
                <span className="text-[10px] text-emerald-400/60">({p.email})</span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={p.role}
                  disabled={!['owner', 'co_owner'].includes(currentUser.role) || p.id === currentUser.id || p.role === 'owner'}
                  onChange={(e) => {
                    void updatePlayerRole(p.id, e.target.value as PlayerRole);
                    setNotification(`Rolle von ${p.name} geändert zu: ${e.target.value}`);
                    setTimeout(() => setNotification(null), 3000);
                  }}
                  className="bg-emerald-950 border border-emerald-700/60 rounded-lg px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
                  title={!['owner', 'co_owner'].includes(currentUser.role)
                    ? 'Keine Berechtigung, Rollen zu ändern'
                    : p.id === currentUser.id
                      ? 'Die eigene Rolle kann nicht geändert werden'
                    : p.role === 'owner'
                      ? 'Die Owner-Rolle ist geschützt'
                      : 'Rolle ändern'}
                >
                  {currentUser.role === 'owner' && (
                    <option value="owner" className="bg-slate-900 text-red-300">Owner</option>
                  )}
                  {currentUser.role === 'owner' && (
                    <option value="co_owner" className="bg-slate-900 text-purple-300">Co-Owner</option>
                  )}
                  {currentUser.role === 'co_owner' && (
                    <option value="co_owner" className="bg-slate-900 text-purple-300">Co-Owner</option>
                  )}
                  <option value="player" className="bg-slate-900 text-white">Spieler</option>
                  <option value="organiser" className="bg-slate-900 text-blue-300">Organiser</option>
                  <option value="admin" className="bg-slate-900 text-amber-400">Administrator</option>
                </select>

                {p.id === currentUser?.id && (
                  <span className="text-[10px] text-amber-400/80 font-bold">(Du)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
