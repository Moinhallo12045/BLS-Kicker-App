'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { 
  Mail, 
  KeyRound, 
  UserCheck, 
  Sparkles, 
  Trophy, 
  Swords, 
  Shield, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  RefreshCw,
  Edit2
} from 'lucide-react';

const AVATAR_LIST = ['⚽', '🎯', '🦁', '👑', '🔥', '⚡', '🦅', '🎱', '🚀', '⚔️', '🎲', '⚓'];

type AuthStep = 'email' | 'verify' | 'profile';

export function AuthLandingView() {
  const { 
    checkWhitelistAndSendCode, 
    verifyCode, 
    completeProfileCreation,
    whitelist 
  } = useStore();

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Profile setup fields
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('⚽');

  // Status feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // STEP 1: Email eingeben & gegen Whitelist prüfen
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await checkWhitelistAndSendCode(email);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    setSuccessMsg(res.message);
    setStep('verify');
  };

  // STEP 2: Verifikationscode eingeben & prüfen
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = verifyCode(email, verificationCode);
    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    // Wenn der Spieler bereits existiert, wurde er im Store direkt eingeloggt!
    if (res.isExistingPlayer) {
      setSuccessMsg(res.message);
      return;
    }

    // Wenn neuer Spieler: weiter zum Profil-Anlegen (Step 3)
    setSuccessMsg('E-Mail erfolgreich bestätigt! Bitte richte dein Profil ein.');
    setStep('profile');
  };

  // STEP 3: Profil anlegen (Spielername & Avatar)
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const res = completeProfileCreation({
      email,
      name,
      avatar,
    });

    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-8 max-w-md mx-auto">
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
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mt-1">
            KICKER LEAGUE
          </h1>
          <p className="text-xs text-emerald-300/80 mt-0.5 max-w-xs mx-auto">
            Geschlossene digitale Tischkicker-Liga mit ELO-System und Turniermodus.
          </p>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="wood-panel p-5 relative shadow-2xl">
        {/* Step Indicator Header */}
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

        {/* Error Feedback */}
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-neon-lime" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* SCHRITT 1: E-Mail eingeben & gegen Whitelist prüfen               */}
        {/* ================================================================= */}
        {step === 'email' && (
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
                className="w-full bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-emerald-500/40 focus:outline-none focus:border-amber-400 font-medium"
              />
              <p className="text-[10px] text-emerald-400/70 mt-1.5">
                * Nur freigeschaltete Adressen/Domains erhalten Zutritt zur geschlossenen Liga.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>{isLoading ? 'Prüfe Whitelist...' : 'Weiter & Code anfordern'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* SCHRITT 2: 6-stelligen Verifikationscode eingeben                */}
        {/* ================================================================= */}
        {step === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-xs text-emerald-200">
                Code gesendet an: <strong className="text-white">{email}</strong>
              </div>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-[10px] text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Andere E-Mail verwenden
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1 text-center">
                6-stelliger Verifikationscode
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-[#0a2014] border-2 border-amber-400/70 rounded-xl py-3 text-center text-2xl font-mono font-black tracking-[0.4em] text-white placeholder-emerald-500/30 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>Code bestätigen</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

            <button
              type="button"
              onClick={handleEmailSubmit}
              className="w-full text-center text-[11px] text-emerald-400/80 hover:text-white flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Neuen Code senden
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* SCHRITT 3: Spielerprofil anlegen                                  */}
        {/* ================================================================= */}
        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="text-center">
              <h3 className="font-display text-lg font-bold text-white">
                Profil einrichten
              </h3>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Wähle deinen Spielernamen und dein Liga-Icon
              </p>
            </div>

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
                className="w-full bg-[#0a2014] border border-emerald-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-emerald-500/40 focus:outline-none focus:border-amber-400 font-bold"
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
                    className={`h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
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
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span>Profil anlegen & Liga starten</span>
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
