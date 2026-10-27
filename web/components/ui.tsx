import Link from 'next/link';
import type { ReactNode } from 'react';
import { sessionToken } from '@/lib/api';

export async function Nav() {
  const signedIn = !!(await sessionToken());
  const link = 'rounded px-2 py-1 text-sm text-slate-300 hover:text-white';
  return (
    <header className="border-b border-ink-700/70 bg-ink-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3" aria-label="Main">
        <Link href="/" className="font-black tracking-tight text-white">DBZ <span className="text-ember-500">RUSH</span> FIGHTER 2.0</Link>
        <div className="flex flex-wrap items-center gap-1">
          <Link className={link} href="/leaderboard">Leaderboard</Link>
          {signedIn ? (<>
            <Link className={link} href="/dashboard">Dashboard</Link>
            <Link className={link} href="/matches">Matches</Link>
            <Link className={link} href="/settings">Settings</Link>
          </>) : (<>
            <Link className={link} href="/login">Sign in</Link>
            <Link className="rounded bg-ember-500 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-ember-400" href="/register">Create account</Link>
          </>)}
        </div>
      </nav>
    </header>
  );
}

export function Page({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </main>
  );
}
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <section className={`rounded-xl border border-ink-700 bg-ink-900/80 p-4 sm:p-5 ${className}`}>{children}</section>;
export const H2 = ({ children }: { children: ReactNode }) => <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{children}</h2>;
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-2xl font-bold text-white">{value}</div>{hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}</div>;
}
export function Badge({ children, tone = 'slate', title }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue'; title?: string }) {
  const t = { slate: 'bg-ink-700 text-slate-300', green: 'bg-emerald-500/15 text-emerald-300', red: 'bg-rose-500/15 text-rose-300', amber: 'bg-amber-500/15 text-amber-300', blue: 'bg-sky-500/15 text-sky-300' }[tone];
  return <span title={title} className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}
export const SeedBadge = () => <Badge tone="amber" title="Simulated development data, not a real player">DEV SEED</Badge>;
export const ResultBadge = ({ r }: { r: 'won' | 'lost' | 'undecided' }) => <Badge tone={r === 'won' ? 'green' : r === 'lost' ? 'red' : 'slate'}>{r === 'won' ? 'WIN' : r === 'lost' ? 'LOSS' : 'NO RESULT'}</Badge>;
export const ErrorBox = ({ children }: { children: ReactNode }) => <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">{children}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="rounded-lg border border-dashed border-ink-600 p-6 text-center text-slate-400">{children}</div>;
export function Footer() {
  return <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-slate-500">DBZ Rush Fighter 2.0 · final year project, Computer Science · An unofficial fan project, not affiliated with the Dragon Ball franchise.</footer>;
}
