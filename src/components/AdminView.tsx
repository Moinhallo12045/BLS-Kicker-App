'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { ShieldCheck, AlertTriangle, Key, Users, Edit2, Trash2, Mail, Plus, Loader2 } from 'lucide-react';
import { Player, PlayerRole } from '@/types';
import { isAdminRole, parseScore, playerNames, runAction, validateScore } from '@/lib/matchViews';
import { AuditLog } from './AuditLog';

const ROLE_LABELS: Record<PlayerRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-Owner',
  admin: 'Administrator',
  organiser: 'Organiser',
  player: 'Spieler',
};

const INVITE_CODE_PATTERN = /^[A-Z0-9_-]{4,64}$/;
const MAX_INVITE_USES = 10000;

/** Roles the acting user may assign to the target (mirrors the DB rules). */
function assignableRoles(actor: Player, target: Player): PlayerRole[] {
  if (actor.id === target.id || target.role === 'owner') return [];
  if (actor.role === 'owner') return ['co_owner', 'admin', 'organiser', 'player'];
  if (actor.role === 'co_owner' && target.role !== 'co_owner') return ['admin', 'organiser', 'player'];
  return [];
}

function canSuspend(actor: Player, target: Player): boolean {
  if (actor.id === target.id || target.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'co_owner') return target.role !== 'co_owner';
  if (actor.role === 'admin') return !['co_owner', 'admin'].includes(target.role);
  return false;
}

type Notice = { text: string; error: boolean };

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
    updatePlayerRole,
    setPlayerSuspension,
    deletePlayer,
  } = useStore();

  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState('50');
  const [newWhitelistPattern, setNewWhitelistPattern] = useState('');
  const [notification, setNotification] = useState<Notice | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAction = useRef<(() => Promise<unknown>) | null>(null);

  const [resolvingMatchId, setResolvingMatchId] = useState<string | null>(null);
  const [customScoreA, setCustomScoreA] = useState('');
  const [customScoreB, setCustomScoreB] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const notify = (text: string, error: boolean) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotification({ text, error });
    noticeTimer.current = setTimeout(() => setNotification(null), error ? 8000 : 4000);
  };

  /** Runs one admin action at a time and reports the backend result. */
  const perform = async (key: string, action: () => unknown, fallbackError: string) => {
    if (busyKey) return null;
    setBusyKey(key);
    const result = await runAction(action, { fallbackError });
    setBusyKey(null);
    notify(result.message, !result.success);
    retryAction.current = result.success ? null : () => perform(key,action,fallbackError);
    return result;
  };

  if (!currentUser || !isAdminRole(currentUser.role)) {
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

  const disputedMatches = matches.filter((m) => m.status === 'disputed');
  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    const uses = Number(maxUses);
    if (!INVITE_CODE_PATTERN.test(code)) {
      notify('Code: 4–64 Zeichen, nur A–Z, 0–9, „-“ und „_“.', true);
      return;
    }
    if (!Number.isInteger(uses) || uses < 1 || uses > MAX_INVITE_USES) {
      notify(`Maximale Nutzungen: ganze Zahl zwischen 1 und ${MAX_INVITE_USES}.`, true);
      return;
    }
    const result = await perform('invite', () => createInviteCode(code, uses), 'Code konnte nicht angelegt werden.');
    if (result?.success) setNewCode('');
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    const pattern = newWhitelistPattern.trim().toLowerCase();
    if (!pattern) return;
    const result = await perform('whitelist-add', () => addWhitelistEntry(pattern), 'Eintrag konnte nicht gespeichert werden.');
    if (result?.success) setNewWhitelistPattern('');
  };

  const handleResolve = async (matchId: string) => {
    const a = parseScore(customScoreA);
    const b = parseScore(customScoreB);
    const error = validateScore(a, b);
    if (error) {
      setResolveError(error);
      return;
    }
    setResolveError(null);
    const result = await perform(
      `resolve-${matchId}`,
      () => adminResolveDispute(matchId, 'confirm', a as number, b as number),
      'Entscheidung konnte nicht gespeichert werden.'
    );
    if (result?.success) setResolvingMatchId(null);
    else if (result) setResolveError(result.message);
  };

  const inputBase =
    'min-h-[44px] bg-emerald-950/80 border border-emerald-800 rounded-xl px-3 text-xs text-white placeholder-emerald-400/50 focus:outline-none focus:border-amber-400';

  return (
    <div className="space-y-5">
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
        <div
          role={notification.error ? 'alert' : 'status'}
          className={`sticky top-2 z-20 p-3 rounded-xl border text-xs font-semibold break-words ${
            notification.error ? 'bg-red-950 border-red-600 text-red-200' : 'bg-emerald-950 border-emerald-600 text-emerald-200'
          }`}
        >
          {notification.text}
          {notification.error && retryAction.current && <button type="button" disabled={Boolean(busyKey)}
            onClick={() => void retryAction.current?.()} className="min-h-[44px] ml-3 underline disabled:opacity-50">Erneut versuchen</button>}
        </div>
      )}

      {/* 1. Strittige Spiele */}
      <section className="felt-card p-4 sm:p-5 space-y-4 border-amber-600/50">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Strittige Spiele ({disputedMatches.length})
          </h3>
          <p className="text-[11px] text-emerald-300/80 mt-0.5">
            Strittige Spiele werden primär direkt zwischen den beiden Spielern einvernehmlich gelöst.
          </p>
        </div>

        {disputedMatches.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 text-center text-xs text-emerald-300/60">
            Aktuell liegen keine offenen Einwände vor.
          </div>
        ) : (
          <div className="space-y-3">
            {disputedMatches.map((m) => {
              const disputer = getPlayer(m.disputedBy || '');
              const isResolving = resolvingMatchId === m.id;
              const isTournament = Boolean(m.tournamentId);

              return (
                <div key={m.id} className="p-3 sm:p-4 rounded-xl bg-red-950/30 border border-red-700/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-bold text-white">
                      {m.date} ({m.mode}){isTournament ? ' · Turnier' : ''}
                    </span>
                    <span className="text-red-400 font-bold uppercase text-[10px]">
                      Strittig gemeldet von {disputer?.name || 'Gegner'}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-stone-950/60 p-3 rounded-lg border border-red-900/40">
                    <div className="text-xs font-bold text-amber-300 text-right break-words">{playerNames(players, m.teamA)}</div>
                    <div className="font-mono text-lg font-black text-white whitespace-nowrap">
                      {m.scoreA} : {m.scoreB}
                    </div>
                    <div className="text-xs font-bold text-amber-300 break-words">{playerNames(players, m.teamB)}</div>
                  </div>

                  {m.disputeReason && (
                    <div className="text-xs text-stone-300 p-2 rounded bg-stone-900/80 border border-stone-800 break-words">
                      <strong>Begründung:</strong> {m.disputeReason}
                    </div>
                  )}
                  {m.disputeProposedScoreA != null && m.disputeProposedScoreB != null && (
                    <div className="text-xs text-amber-300">
                      Vorgeschlagenes Ergebnis: <strong className="font-mono">{m.disputeProposedScoreA} : {m.disputeProposedScoreB}</strong>
                    </div>
                  )}

                  {isTournament ? (
                    <p className="text-[11px] text-purple-300/80">
                      Turnierspiel – bitte im Turnierbaum korrigieren oder zurücksetzen.
                    </p>
                  ) : !isResolving ? (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => {
                          if (!window.confirm('Spiel wirklich annullieren? Die Wertung wird zurückgenommen.')) return;
                          void perform(`cancel-${m.id}`, () => adminResolveDispute(m.id, 'cancel'), 'Annullierung fehlgeschlagen.');
                        }}
                        className="min-h-[44px] px-3 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-bold border border-red-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        {busyKey === `cancel-${m.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Spiel annullieren
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => {
                          setResolvingMatchId(m.id);
                          setResolveError(null);
                          setCustomScoreA(String(m.disputeProposedScoreA ?? m.scoreA));
                          setCustomScoreB(String(m.disputeProposedScoreB ?? m.scoreB));
                        }}
                        className="min-h-[44px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black flex items-center gap-1 disabled:opacity-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Ergebnis festlegen & werten
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-stone-900 border border-amber-500/60 space-y-3">
                      <div className="text-xs font-bold text-amber-300">Amtliches Ergebnis festlegen (0–10, kein Unentschieden):</div>
                      <div className="flex items-center justify-center gap-4">
                        {[
                          { label: 'Team A Tore', value: customScoreA, set: setCustomScoreA },
                          { label: 'Team B Tore', value: customScoreB, set: setCustomScoreB },
                        ].map((field, i) => (
                          <React.Fragment key={field.label}>
                            {i === 1 && <span className="font-bold text-white text-xl">:</span>}
                            <label className="text-center">
                              <span className="text-[10px] text-emerald-400 block mb-1">{field.label}</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={2}
                                value={field.value}
                                onChange={(e) => field.set(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-16 h-11 text-center font-mono text-xl font-bold bg-stone-950 border border-emerald-600 rounded-lg text-white"
                              />
                            </label>
                          </React.Fragment>
                        ))}
                      </div>
                      {resolveError && (
                        <p role="alert" className="text-xs text-red-300">
                          {resolveError}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setResolvingMatchId(null)}
                          disabled={busyKey === `resolve-${m.id}`}
                          className="min-h-[44px] px-3 text-xs text-stone-300 hover:text-white"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyKey)}
                          onClick={() => handleResolve(m.id)}
                          className="min-h-[44px] px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1 disabled:opacity-50"
                        >
                          {busyKey === `resolve-${m.id}` && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Ergebnis bestätigen & werten
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Einladungscodes */}
      <section className="felt-card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            Einladungscodes verwalten
          </h3>
          <p className="text-xs text-emerald-300/80">
            Da die Kicker League eine geschlossene Community ist, ist eine Registrierung nur mit gültigem Code möglich.
          </p>
        </div>

        <form onSubmit={handleCreateCode} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            required
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Neuer Code (z.B. SOMMER-LIGA)"
            aria-label="Neuer Einladungscode"
            maxLength={64}
            autoCapitalize="characters"
            className={`${inputBase} flex-1 uppercase font-mono font-bold`}
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ''))}
              aria-label="Maximale Nutzungen"
              title="Maximale Nutzungen"
              className={`${inputBase} w-24 text-center`}
            />
            <button
              type="submit"
              disabled={Boolean(busyKey)}
              className="flex-1 sm:flex-none min-h-[44px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {busyKey === 'invite' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Code anlegen
            </button>
          </div>
        </form>

        <div className="divide-y divide-emerald-900/30">
          {inviteCodes.length === 0 && <p className="text-xs text-emerald-300/60 py-2">Noch keine Codes angelegt.</p>}
          {inviteCodes.map((c) => (
            <div key={c.code} className="py-2.5 flex flex-wrap items-center justify-between gap-1 text-xs">
              <div className="min-w-0">
                <span className="font-mono font-bold text-amber-300 bg-stone-900 px-2 py-0.5 rounded border border-amber-600/40 break-all">
                  {c.code}
                </span>
                <span className="text-[10px] text-emerald-400/60 ml-2">Erstellt am {c.createdAt}</span>
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
      </section>

      {/* 3. E-Mail Whitelist */}
      <section className="felt-card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            E-Mail Whitelist ({whitelist.length} Einträge)
          </h3>
          <p className="text-xs text-emerald-300/80">
            Nur Spieler mit diesen E-Mail-Adressen oder Domains erhalten einen Verifikationscode.
          </p>
        </div>

        <form onSubmit={handleAddWhitelist} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            required
            value={newWhitelistPattern}
            onChange={(e) => setNewWhitelistPattern(e.target.value.toLowerCase())}
            placeholder="z.B. @law-school.de oder gast@partner.de"
            aria-label="E-Mail oder Domain freischalten"
            autoCapitalize="none"
            autoCorrect="off"
            className={`${inputBase} flex-1 font-mono`}
          />
          <button
            type="submit"
            disabled={Boolean(busyKey)}
            className="min-h-[44px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {busyKey === 'whitelist-add' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Freischalten
          </button>
        </form>

        <div className="divide-y divide-emerald-900/30 max-h-60 overflow-y-auto overscroll-contain pr-1">
          {whitelist.map((w) => (
            <div key={w.id} className="py-1 flex items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700/50 break-all">
                  {w.pattern}
                </span>
                <span className="text-[10px] text-emerald-400/60">
                  {w.pattern.startsWith('@') ? 'Ganze Domain' : 'Einzelne E-Mail'}
                </span>
              </div>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => {
                  if (!window.confirm(`„${w.pattern}“ von der Whitelist entfernen?`)) return;
                  void perform(`whitelist-${w.id}`, () => removeWhitelistEntry(w.id), 'Eintrag konnte nicht entfernt werden.');
                }}
                className="w-11 h-11 shrink-0 flex items-center justify-center text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40 disabled:opacity-50"
                aria-label={`${w.pattern} von Whitelist entfernen`}
              >
                {busyKey === `whitelist-${w.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Spieler & Rollen */}
      <section className="felt-card p-4 sm:p-5 space-y-4">
        <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Spieler-Rollen ({players.filter((p) => !p.isDeleted).length} Spieler)
        </h3>
        <p className="text-[11px] text-emerald-300/80">
          Owner und Co-Owner können Spieler auch mit Historie löschen. Das Profil wird
          anonymisiert und deaktiviert; Ergebnisse bleiben erhalten. Eigener Account und Owner-Profile sind geschützt.
        </p>

        <div className="max-h-[28rem] overflow-y-auto overscroll-contain space-y-1.5 pr-1">
          {players.filter((p) => !p.isDeleted).map((p) => {
            const roles = assignableRoles(currentUser, p);
            const roleEditable = roles.length > 0;
            const suspendable = canSuspend(currentUser, p);
            const roleKey = `role-${p.id}`;
            const suspendKey = `suspend-${p.id}`;
            const deletable = ['owner', 'co_owner'].includes(currentUser.role)
              && p.id !== currentUser.id && p.role !== 'owner';
            const deleteKey = `delete-${p.id}`;
            return (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span aria-hidden>{p.avatar}</span>
                  <span className="font-bold text-white truncate">{p.name}</span>
                  {p.email && <span className="text-[10px] text-emerald-400/60 truncate">({p.email})</span>}
                  {p.id === currentUser.id && <span className="text-[10px] text-amber-400/80 font-bold">(Du)</span>}
                  {p.isSuspended && (
                    <span className="text-[9px] px-1 rounded bg-red-900/50 text-red-300 font-bold">Gesperrt</span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {roleEditable ? (
                    <select
                      value={p.role}
                      disabled={Boolean(busyKey)}
                      aria-label={`Rolle von ${p.name}`}
                      onChange={(e) => {
                        const role = e.target.value as PlayerRole;
                        if (role === p.role) return;
                        void perform(roleKey, () => updatePlayerRole(p.id, role), 'Rolle konnte nicht geändert werden.');
                      }}
                      className="min-h-[44px] bg-emerald-950 border border-emerald-700/60 rounded-lg px-2 text-xs text-amber-300 font-bold focus:outline-none cursor-pointer disabled:opacity-60"
                    >
                      {!roles.includes(p.role) && (
                        <option value={p.role} disabled className="bg-slate-900">
                          {ROLE_LABELS[p.role]}
                        </option>
                      )}
                      {roles.map((role) => (
                        <option key={role} value={role} className="bg-slate-900 text-white">
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="px-2 py-1 rounded-lg bg-emerald-950 border border-emerald-800/60 text-amber-300/80 font-bold"
                      title="Keine Berechtigung, diese Rolle zu ändern"
                    >
                      {ROLE_LABELS[p.role]}
                    </span>
                  )}
                  {busyKey === roleKey && <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />}

                  {suspendable && (
                    <button
                      type="button"
                      disabled={Boolean(busyKey)}
                      onClick={() => {
                        const question = p.isSuspended ? `${p.name} entsperren?` : `${p.name} sperren?`;
                        if (!window.confirm(question)) return;
                        void perform(suspendKey, () => setPlayerSuspension(p.id, !p.isSuspended), 'Sperrstatus konnte nicht geändert werden.');
                      }}
                      className={`min-h-[44px] rounded-lg px-3 text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 ${
                        p.isSuspended ? 'bg-emerald-700/40 text-emerald-200' : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      {busyKey === suspendKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {p.isSuspended ? 'Entsperren' : 'Sperren'}
                    </button>
                  )}
                  {deletable && (
                    <button
                      type="button"
                      disabled={Boolean(busyKey)}
                      aria-label={`${p.name} löschen`}
                      onClick={() => {
                        if (!window.confirm(`${p.name} dauerhaft löschen und anonymisieren? Frühere Spiele und Ergebnisse bleiben erhalten. Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
                        void perform(deleteKey, () => deletePlayer(p.id), 'Spieler konnte nicht gelöscht werden.');
                      }}
                      className="min-h-[44px] rounded-lg px-3 text-[11px] font-bold flex items-center gap-1 bg-red-900/40 text-red-300 disabled:opacity-50"
                    >
                      {busyKey === deleteKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <AuditLog />
    </div>
  );
}
