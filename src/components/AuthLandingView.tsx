'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabaseClient';
import {
  Mail,
  KeyRound,
  Sparkles,
  Trophy,
  Shield,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Edit2,
  Loader2,
  LogOut,
  Ban,
} from 'lucide-react';
import { runAction } from '@/lib/matchViews';
import { AVATAR_LIST } from '@/lib/avatars';

type AuthStep = 'checking' | 'email' | 'verify' | 'profile' | 'loadingProfile' | 'suspended';

type OwnProfile = { id?: string | null; is_suspended?: boolean | null } | null;

export function AuthLandingView() {
  const {
    checkWhitelistAndSendCode,
    verifyCode,
    completeProfileCreation,
    refreshState,
    logout,
    players,
    switchUser,
  } = useStore();

  const [step, setStep] = useState<AuthStep>(supabase ? 'checking' : 'email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('⚽');
  const [yearJoined, setYearJoined] = useState('');
  const isExternal = !email.trim().toLowerCase().endsWith('@law-school.de');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  /**
   * Determines the auth step from the current session and the caller's own
   * profile (get_my_profile). Never relies on public player emails.
   */
  const checkSession = useCallback(async (showChecking: boolean) => {
    if (!supabase) return;
    const requestId = ++requestRef.current;
    const isStale = () => !mountedRef.current || requestId !== requestRef.current;
    if (showChecking) setStep('checking');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (isStale()) return;
      if (sessionError) throw sessionError;
      const session = sessionData.session;
      if (!session) {
        setStep((prev) => (prev === 'verify' ? prev : 'email'));
        return;
      }
      const { data, error } = await supabase.rpc('get_my_profile').maybeSingle();
      if (isStale()) return;
      if (error) throw error;
      const profile = data as OwnProfile;
      if (profile?.id) {
        setStep(profile.is_suspended ? 'suspended' : 'loadingProfile');
        return;
      }
      setEmail(session.user.email || '');
      setStep('profile');
    } catch (error) {
      if (isStale()) return;
      setErrorMsg(error instanceof Error && error.message ? error.message : 'Anmeldestatus konnte nicht geprüft werden.');
      setStep((prev) => (prev === 'checking' ? 'email' : prev));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!supabase) return;
    void checkSession(true);

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      // Defer Supabase calls out of the auth callback to avoid auth lock deadlocks.
      setTimeout(() => {
        if (!mountedRef.current) return;
        if (event === 'SIGNED_OUT') {
          requestRef.current++;
          setStep('email');
          return;
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          void checkSession(false);
        }
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      authListener?.subscription.unsubscribe();
    };
  }, [checkSession]);

  const handleLogout = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const result = await runAction(logout, { fallbackError: 'Abmelden fehlgeschlagen.', voidIsSuccess: true });
    if (!mountedRef.current) return;
    setIsLoading(false);
    if (!result.success) {
      setErrorMsg(result.message);
      return;
    }
    setSuccessMsg(null);
    setVerificationCode('');
    setStep('email');
  };

  const handleRetryProfile = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await refreshState();
    } catch (error) {
      if (mountedRef.current) setErrorMsg(error instanceof Error ? error.message : 'Aktualisierung fehlgeschlagen.');
    }
    if (!mountedRef.current) return;
    setIsLoading(false);
    void checkSession(false);
  };

  // STEP 1: Email eingeben & gegen Whitelist prüfen
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await runAction(() => checkWhitelistAndSendCode(email), { fallbackError: 'Code konnte nicht angefordert werden.' });
    if (!mountedRef.current) return;
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    setSuccessMsg(res.message);
    setStep('verify');
  };

  // STEP 2: Verifikationscode eingeben & prüfen
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await runAction(() => verifyCode(email, verificationCode), { fallbackError: 'Code konnte nicht geprüft werden.' });
    if (!mountedRef.current) return;
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message);
      // A suspended profile is rejected by the store after a valid code.
      void checkSession(false);
      return;
    }
    setSuccessMsg(res.message);
    setVerificationCode('');
    void checkSession(false);
  };

  // STEP 3: Profil anlegen (Spielername & Avatar)
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Bitte gib einen Spielernamen ein.');
      return;
    }
    setIsLoading(true);

    const res = await runAction(
      () => completeProfileCreation({
        email,
        name: name.trim(),
        avatar,
        yearJoined: isExternal ? null : Number(yearJoined),
      }),
      { fallbackError: 'Profil konnte nicht erstellt werden.' }
    );
    if (!mountedRef.current) return;
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }
    setSuccessMsg(res.message);
    void checkSession(false);
  };

  const inputClass =
    'w-full min-h-[44px] bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-emerald-500/40 focus:outline-none focus:border-amber-400';
  const showStepper = step === 'email' || step === 'verify' || step === 'profile';

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between px-4 py-6 sm:py-8 max-w-md mx-auto pt-safe pb-safe">
      {/* Brand Hero */}
      <div className="text-center pt-2 pb-5 space-y-2">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 p-1 shadow-[0_0_35px_rgba(245,158,11,0.35)] flex items-center justify-center">
          <span className="text-4xl">⚽</span>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-extrabold flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            BLS Community Liga
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
            KICKER LEAGUE
          </h1>
          <p className="text-xs text-emerald-300/80 mt-0.5 max-w-xs mx-auto">
            Geschlossene digitale Tischkicker-Liga mit ELO-System und Turniermodus.
          </p>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="wood-panel p-4 sm:p-5 relative shadow-2xl">
        {/* Step Indicator Header */}
        {showStepper && (
        <div className="flex items-center justify-between text-[11px] font-bold pb-4 mb-4 border-b border-[#7e4b27]/40">
          <div className={`flex items-center gap-1.5 ${step === 'email' ? 'text-amber-400' : 'text-emerald-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#081a10] border border-current flex items-center justify-center text-[10px]">
              1
            </span>
            <span>E-Mail</span>
          </div>

          <span className="text-stone-600">➔</span>

          <div className={`flex items-center gap-1.5 ${step === 'verify' ? 'text-amber-400' : step === 'profile' ? 'text-emerald-400' : 'text-stone-500'}`}>
            <span className="w-5 h-5 rounded-full bg-[#081a10] border border-current flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Code</span>
          </div>

          <span className="text-stone-600">➔</span>

          <div className={`flex items-center gap-1.5 ${step === 'profile' ? 'text-amber-400' : 'text-stone-500'}`}>
            <span className="w-5 h-5 rounded-full bg-[#081a10] border border-current flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Profil</span>
          </div>
        </div>
        )}

        {/* Error Feedback */}
        {errorMsg && (
          <div role="alert" className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMsg && (
          <div role="status" className="mb-4 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-neon-lime" />
            <span className="break-words">{successMsg}</span>
          </div>
        )}

        {!supabase && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 text-xs text-amber-200">
              Die sichere Anmeldung ist nicht konfiguriert. Die App läuft im lokalen Demo-Modus – Daten bleiben nur in
              diesem Browser.
            </div>
            {players.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-emerald-200">Demo-Spieler wählen</div>
                <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto overscroll-contain pr-1">
                  {players
                    .filter((p) => !p.isSuspended)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => switchUser(p.id)}
                        className="min-h-[44px] px-3 rounded-xl bg-[#0a2014] border border-emerald-800/60 hover:border-amber-400 text-left text-xs text-white font-bold flex items-center gap-2"
                      >
                        <span className="text-lg" aria-hidden>{p.avatar}</span>
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-300/70">Keine Demo-Spieler vorhanden.</p>
            )}
          </div>
        )}

        {supabase && step === 'checking' && (
          <div className="py-8 flex flex-col items-center gap-2 text-xs text-emerald-200" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            Anmeldestatus wird geprüft…
          </div>
        )}

        {supabase && step === 'loadingProfile' && (
          <div className="py-4 space-y-3 text-center" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
            <p className="text-xs text-emerald-200">Profil wird geladen…</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleRetryProfile}
                disabled={isLoading}
                className="flex-1 min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Erneut laden
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoading}
                className="flex-1 min-h-[44px] rounded-xl bg-red-950/50 border border-red-700/50 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <LogOut className="w-3.5 h-3.5" />
                Abmelden
              </button>
            </div>
          </div>
        )}

        {supabase && step === 'suspended' && (
          <div className="space-y-3 text-center" role="alert">
            <Ban className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="font-display text-lg font-bold text-white">Spielerprofil gesperrt</h3>
            <p className="text-xs text-red-200/90">
              Dein Zugang zur Kicker League wurde von der Administration gesperrt. Bitte wende dich an die Liga-Leitung, wenn
              du Fragen dazu hast.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full min-h-[44px] rounded-xl bg-red-950/50 border border-red-700/50 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <LogOut className="w-3.5 h-3.5" />
              Abmelden
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* SCHRITT 1: E-Mail eingeben & gegen Whitelist prüfen               */}
        {/* ================================================================= */}
        {supabase && step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                Deine E-Mail-Adresse
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vorname.nachname@law-school.de"
                className={`${inputClass} font-medium`}
                autoComplete="email"
                autoCapitalize="none"
              />
              <p className="text-[10px] text-emerald-400/70 mt-1.5">
                * Nur freigeschaltete Adressen/Domains erhalten Zutritt zur geschlossenen Liga.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] py-3 rounded-xl disabled:opacity-60 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>{isLoading ? 'Prüfe Whitelist…' : 'Weiter & Code anfordern'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* SCHRITT 2: 6-stelligen Verifikationscode eingeben                */}
        {/* ================================================================= */}
        {supabase && step === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-xs text-emerald-200">
                Code gesendet an: <strong className="text-white">{email}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setVerificationCode('');
                  setErrorMsg(null);
                }}
                className="min-h-[44px] px-2 text-[11px] text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Andere E-Mail verwenden
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1 text-center">
                Verifikationscode (aus deiner E-Mail)
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code eingeben"
                className="w-full bg-[#0a2014] border-2 border-amber-400/70 rounded-xl py-3 text-center text-xl sm:text-2xl font-mono font-black tracking-[0.25em] text-white placeholder-emerald-500/30 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[10px] text-emerald-400/70 text-center mt-1.5">
                Bitte prüfe auch deinen Spam-Ordner. (Du kannst den 6-stelligen Code eingeben <em>oder</em> direkt auf den Bestätigungslink in der E-Mail klicken.)
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] py-3 rounded-xl disabled:opacity-60 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>{isLoading ? 'Prüfe Code…' : 'Code bestätigen'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

            <button
              type="button"
              onClick={() => void handleEmailSubmit()}
              disabled={isLoading}
              className="w-full min-h-[44px] text-center disabled:opacity-60 text-[11px] text-emerald-400/80 hover:text-white flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Neuen Code senden
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* SCHRITT 3: Spielerprofil anlegen                                  */}
        {/* ================================================================= */}
        {supabase && step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="text-center">
              <h3 className="font-display text-lg font-bold text-white">
                Profil einrichten
              </h3>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Wähle deinen Spielernamen und dein Liga-Icon
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-1">
                {isExternal
                  ? 'Deine E-Mail-Adresse wird als extern erkannt.'
                  : 'Deine Uni-Mail bestätigt deinen Uni-Status.'}
              </p>
            </div>

            {!isExternal && <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Dein Uni-Jahrgang
              </label>
              <select
                required
                value={yearJoined}
                onChange={(e) => setYearJoined(e.target.value)}
                className={`${inputClass} font-bold`}
              >
                <option value="" disabled>Uni-Jahrgang auswählen</option>
                {Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, index) => {
                  const year = new Date().getFullYear() - index;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>}

            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Dein Spielername
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Alex K. oder Birk"
                className={`${inputClass} font-bold`}
                maxLength={40}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1.5">
                Avatar-Symbol wählen
              </label>
              <div className="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-[#081a10] border border-emerald-900/60">
                {AVATAR_LIST.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    aria-label={`Avatar ${av}`}
                    aria-pressed={avatar === av}
                    className={`h-11 rounded-lg text-lg flex items-center justify-center transition-all ${
                      avatar === av
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
              disabled={isLoading}
              className="w-full min-h-[48px] py-3 rounded-xl disabled:opacity-60 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>{isLoading ? 'Profil wird erstellt…' : 'Profil anlegen & Liga starten'}</span>
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>
        )}
      </div>

      {/* Feature Highlights Footer */}
      <div className="grid grid-cols-3 gap-2 text-center pt-6">
        <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
          <Shield className="w-4 h-4 mx-auto text-amber-400 mb-1" />
          <div className="text-[10px] font-bold text-white">Whitelist</div>
          <div className="text-[9px] text-emerald-400/60">Geschützt</div>
        </div>

        <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
          <KeyRound className="w-4 h-4 mx-auto text-amber-400 mb-1" />
          <div className="text-[10px] font-bold text-white">E-Mail Code</div>
          <div className="text-[9px] text-emerald-400/60">Sicherer Login</div>
        </div>

        <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
          <Trophy className="w-4 h-4 mx-auto text-amber-400 mb-1" />
          <div className="text-[10px] font-bold text-white">Liga & Elo</div>
          <div className="text-[9px] text-emerald-400/60">Turniermodus</div>
        </div>
      </div>
    </div>
  );
}
