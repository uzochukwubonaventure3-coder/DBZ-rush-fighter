'use client';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return <LazyMotion features={domAnimation} strict><m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }}>{children}</m.div></LazyMotion>;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="rounded bg-ink-700 px-3 py-1.5 text-sm hover:bg-ink-600" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked: user can select the text */ } }}>{done ? 'Copied' : label}</button>;
}

/** Re-fetches server data while coaching is still being generated. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => { if (!active) return; let n = 0; const t = setInterval(() => { if (++n > 20) clearInterval(t); else router.refresh(); }, 2000); return () => clearInterval(t); }, [active, router]);
  return null;
}

export function ActionButton({ url, label, busyLabel, className = '', onDone }: { url: string; label: string; busyLabel: string; className?: string; onDone?: (json: any) => void }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return <>
    <button type="button" disabled={busy} className={`rounded bg-ink-700 px-3 py-1.5 text-sm hover:bg-ink-600 disabled:opacity-60 ${className}`}
      onClick={async () => { setBusy(true); setErr(''); try { const r = await fetch(url, { method: 'POST' }); const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error ?? 'Something went wrong'); else { onDone?.(j); router.refresh(); } } catch { setErr('Network error'); } setBusy(false); }}>{busy ? busyLabel : label}</button>
    {err && <span role="alert" className="ml-2 text-sm text-rose-300">{err}</span>}
  </>;
}

export function LogoutButton() {
  const router = useRouter();
  return <button type="button" className="rounded bg-ink-700 px-3 py-1.5 text-sm hover:bg-ink-600" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); router.refresh(); }}>Sign out</button>;
}

export function RotateToken() {
  const [token, setToken] = useState('');
  return <div className="space-y-3">
    <ActionButton url="/api/me/rotate-token" label="Generate a new ingest token" busyLabel="Generating…" onDone={(j) => setToken(j.ingestToken)} />
    {token && <TokenBox token={token} />}
  </div>;
}

export function TokenBox({ token }: { token: string }) {
  return <div className="rounded-lg border border-ember-500/40 bg-ember-500/10 p-3">
    <p className="mb-2 text-sm text-ember-400">Copy this now. It is shown once and cannot be recovered; the previous token stops working.</p>
    <div className="flex flex-wrap items-center gap-2"><code className="break-all rounded bg-ink-950 px-2 py-1 text-sm" data-testid="ingest-token">{token}</code><CopyButton text={token} /></div>
  </div>;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [token, setToken] = useState('');
  const input = 'mt-1 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-white';
  if (token) return <div className="space-y-4">
    <h2 className="text-lg font-semibold text-white">Account created</h2>
    <p className="text-slate-300">This is your game ingest token. The game sends it with each match so results land on your account.</p>
    <TokenBox token={token} />
    <button className="rounded-lg bg-ember-500 px-4 py-2 font-semibold text-ink-950 hover:bg-ember-400" onClick={() => { router.push('/dashboard'); router.refresh(); }}>Continue to dashboard</button>
  </div>;
  return <form className="space-y-4" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: f.get('username'), password: f.get('password') }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error ?? 'Request failed');
      else if (mode === 'register') setToken(j.ingestToken);
      else { router.push('/dashboard'); router.refresh(); }
    } catch { setErr('Network error. Check your connection and try again.'); }
    setBusy(false);
  }}>
    <label className="block text-sm text-slate-300">Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoComplete="username" className={input} /></label>
    {mode === 'register' && <p className="-mt-2 text-xs text-slate-500">3–20 letters, digits or underscores.</p>}
    <label className="block text-sm text-slate-300">Password<input name="password" type="password" required minLength={mode === 'register' ? 8 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={input} /></label>
    {mode === 'register' && <p className="-mt-2 text-xs text-slate-500">At least 8 characters.</p>}
    {err && <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</div>}
    <button disabled={busy} className="w-full rounded-lg bg-ember-500 px-4 py-2 font-semibold text-ink-950 hover:bg-ember-400 disabled:opacity-60">{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
  </form>;
}
