'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Key, UserCheck, Sparkles, Trophy, Swords, Shield, AlertCircle, ArrowRight } from 'lucide-react';

const AVATAR_LIST = ['⚽', '🎯', '🦁', '👑', '🔥', '⚡', '🦅', '🎱', '🚀', '⚔️', '🎲', '⚓'];

export function AuthLandingView() {
  const { players, registerWithInvite, loginPlayer } = useStore();
  const [tab, setTab] = useState<'register' | 'login'>(players.length === 0 ? 'register' : 'login');

  // Register state
  const [regCode, setRegCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAvatar, setRegAvatar] = useState('⚽');

  // Login state
  const [loginInput, setLoginInput] = useState('');

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-detect ?invite= parameter from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get('invite');
      if (inviteParam) {
        setRegCode(inviteParam.toUpperCase());
        setTab('register');
      }
    }
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const res = registerWithInvite({
      name: regName,
      email: regEmail,
      inviteCode: regCode,
      avatar: regAvatar,
    });

    if (!res.success) {
      setErrorMessage(res.message);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const res = loginPlayer(loginInput);
    if (!res.success) {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-8 max-w-md mx-auto">
      {/* Brand Hero */}
      <div className="text-center pt-4 pb-6 space-y-3">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 p-1 shadow-[0_0_35px_rgba(245,158,11,0.35)] flex items-center justify-center">
          <span className="text-4xl">⚽</span>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-extrabold flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            BLS Community Liga
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mt-1">
            KICKER LEAGUE
          </h1>
          <p className="text-xs text-emerald-300/80 mt-1 max-w-xs mx-auto">
            Die geschlossene, digitale Tischkicker-Liga mit ELO-System, Turniermodus und Leveling.
          </p>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="wood-panel p-5 relative shadow-2xl">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#07160f] p-1 rounded-xl border border-emerald-900/60 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'register'
                ? 'bg-amber-400 text-stone-950 font-black shadow-md'
                : 'text-emerald-200/70 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Registrieren
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'login'
                ? 'bg-amber-400 text-stone-950 font-black shadow-md'
                : 'text-emerald-200/70 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Anmelden
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: REGISTRIERUNG (MIT EINLADUNGSCODE) */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
                <span>Einladungscode</span>
                <span className="text-[10px] text-emerald-400/80 font-normal">
                  Standard: KICKER2026
                </span>
              </label>
              <input
                type="text"
                required
                value={regCode}
                onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                placeholder="z.B. KICKER2026"
                className="w-full bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase font-mono font-bold tracking-wider placeholder-emerald-500/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Dein Spielername
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="z.B. Birk oder Alex K."
                className="w-full bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-emerald-500/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="name@beispiel.de"
                className="w-full bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-emerald-500/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Avatar Picker */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1.5">
                Avatar-Symbol wählen
              </label>
              <div className="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-[#081a10] border border-emerald-900/60">
                {AVATAR_LIST.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setRegAvatar(av)}
                    className={`h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                      regAvatar === av
                        ? 'bg-amber-400 text-stone-950 scale-110 shadow'
                        : 'hover:bg-emerald-950/60 text-white'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>Liga beitreten & Profil anlegen</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </form>
        )}

        {/* TAB 2: ANMELDUNG (FÜR BEREITS REGISTRIERTE SPIELER) */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Spielername oder E-Mail
              </label>
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="z.B. Birk"
                className="w-full bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-emerald-500/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>Anmelden & Loskickern</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Quick Player Select if any players already registered */}
            {players.length > 0 && (
              <div className="pt-3 border-t border-[#7e4b27]/40 space-y-2">
                <span className="text-[11px] text-emerald-300/70 block text-center">
                  Oder Profil direkt auswählen:
                </span>
                <div className="flex flex-wrap gap-1.5 justify-center max-h-32 overflow-y-auto">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => loginPlayer(p.name)}
                      className="px-2.5 py-1 rounded-lg bg-[#0e271a] border border-emerald-700/40 text-xs font-semibold text-emerald-200 hover:text-white hover:border-amber-400 flex items-center gap-1.5 transition-colors"
                    >
                      <span>{p.avatar}</span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-3 gap-2 text-center pt-6">
        <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
          <Swords className="w-4 h-4 mx-auto text-amber-400 mb-1" />
          <div className="text-[10px] font-bold text-white">1v1 & 2v2</div>
          <div className="text-[9px] text-emerald-400/60">Getrennte ELOs</div>
        </div>

        <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
          <Trophy className="w-4 h-4 mx-auto text-amber-400 mb-1" />
          <div className="text-[10px] font-bold text-white">Turniermodus</div>
          <div className="text-[9px] text-emerald-400/60">K.O. & Tabellen</div>
        </div>

        <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
          <Shield className="w-4 h-4 mx-auto text-amber-400 mb-1" />
          <div className="text-[10px] font-bold text-white">Faire Wertung</div>
          <div className="text-[9px] text-emerald-400/60">Direkte Einigung</div>
        </div>
      </div>
    </div>
  );
}
