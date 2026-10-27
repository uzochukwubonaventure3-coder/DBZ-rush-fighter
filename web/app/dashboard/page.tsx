import Link from 'next/link';
import type { Metadata } from 'next';
import { api, guard, requireSession } from '@/lib/api';
import { STYLE_BLURB, num1, pct, signed, when } from '@/lib/format';
import type { MatchRow, Overview } from '@/lib/types';
import { FadeIn } from '@/components/client';
import { LineChart } from '@/components/charts';
import { Badge, Card, Empty, ErrorBox, H2, Page, ResultBadge } from '@/components/ui';
export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const skillValue = (value: number | null) => value === null ? null : Math.max(0, Math.min(1, value));

export default async function Dashboard() {
  const token = await requireSession();
  const [o, m] = await Promise.all([guard(await api<Overview>('/v1/me/overview', { token })), guard(await api<{ matches: MatchRow[] }>('/v1/matches?limit=5', { token }))]);
  if (!o.ok || !o.data) return <Page title="Dashboard"><ErrorBox>{o.error}</ErrorBox></Page>;
  const d = o.data, ps = d.playstyle, f = ps.features, matches = m.data?.matches ?? [];
  const labels = d.progression.map((p) => new Date(p.playedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
  const winRate = d.record.matches > 0 ? d.record.wins / d.record.matches : null;
  const skills = [
    { label: 'Block rate', value: f.blockRate, detail: 'Incoming attacks blocked', color: 'bg-emerald-400' },
    { label: 'Contact rate', value: f.connectRate, detail: 'Attacks that reached', color: 'bg-teal-300' },
    { label: 'Hit share', value: f.damageShare, detail: 'Clean hits made by you', color: 'bg-cyan-300' },
    { label: 'Move variety', value: f.variety, detail: 'Range of moves used', color: 'bg-lime-300' },
  ];
  return (
    <Page title={`Welcome, ${d.player.username}`} subtitle="Player insights · performance analytics from your uploaded matches">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/[0.09] via-ink-900/80 to-ink-900/80 px-4 py-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Player insights</p><p className="mt-1 text-sm text-slate-400">Your match history, skill profile and rating at a glance.</p></div>
        <Link href="/matches" className="rounded-lg border border-emerald-300/30 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-300/10">View match history</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeIn><Card className="h-full border-emerald-400/15 bg-gradient-to-br from-emerald-400/[0.08] to-ink-900/90"><p className="text-xs uppercase tracking-wider text-slate-400">Total games played</p><p className="mt-2 text-3xl font-bold text-white">{d.record.matches.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{d.record.window}</p></Card></FadeIn>
        <FadeIn delay={0.04}><Card className="h-full"><p className="text-xs uppercase tracking-wider text-slate-400">Win rate</p><p className="mt-2 text-3xl font-bold text-emerald-300">{pct(winRate)}</p><p className="mt-1 text-xs text-slate-500">{d.record.wins} wins · {d.record.losses} losses</p></Card></FadeIn>
        <FadeIn delay={0.08}><Card className="h-full"><p className="text-xs uppercase tracking-wider text-slate-400">Attacks / min</p><p className="mt-2 text-3xl font-bold text-white">{num1(f.attacksPerMin)}</p><p className="mt-1 text-xs text-slate-500">Average over last {ps.matchesUsed} matches</p></Card></FadeIn>
        <FadeIn delay={0.12}><Card className="h-full"><p className="text-xs uppercase tracking-wider text-slate-400">Elo rating</p><p className="mt-2 text-3xl font-bold text-white">{d.player.rating.toLocaleString()} <span className="text-sm font-medium text-emerald-300">MMR</span></p><p className="mt-1 text-xs text-slate-500">{d.player.ratedMatches} rated matches · {d.player.ratedWins} wins</p></Card></FadeIn>
      </div>

      {d.record.matches === 0 ? <div className="mt-4"><Empty>No matches yet. Once the game uploads a match, your analytics appear here. Your ingest token is in <Link href="/settings" className="text-emerald-300 underline">Settings</Link>.</Empty></div> : (<>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <Card className="border-emerald-400/15">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3"><div><H2>Elo rating over time</H2><p className="text-xs text-slate-500">Rating changes in rated matches between registered players.</p></div><Badge tone="green">{d.player.rating} MMR</Badge></div>
            <LineChart ariaLabel="Elo rating over time" series={[{ label: 'Rating', color: '#34d399', values: d.ratingHistory.map((r) => r.rating) }]} labels={d.ratingHistory.map((r) => new Date(r.playedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }))} format={(n) => String(Math.round(n))} />
            {d.ratingHistory.length === 0 && <p className="mt-2 text-xs text-slate-500">Ratings appear after rated matches between two registered players.</p>}
          </Card>
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3"><div><H2>Skill distribution</H2><p className="text-xs text-slate-500">Recent match averages</p></div><span className="rounded-full border border-emerald-400/20 px-2.5 py-1 text-xs text-emerald-200">{ps.matchesUsed} matches</span></div>
            <div className="space-y-4">{skills.map((skill) => {
              const normalized = skillValue(skill.value);
              return <div key={skill.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-200">{skill.label}</p><p className="text-[11px] text-slate-500">{skill.detail}</p></div><span className="text-lg font-semibold text-white">{pct(skill.value)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="meter" aria-label={skill.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized === null ? undefined : Math.round(normalized * 100)}><div className={`h-full rounded-full ${skill.color}`} style={{ width: normalized === null ? '0%' : `${normalized * 100}%` }} /></div>
              </div>;
            })}</div>
            <div className="mt-5 border-t border-ink-700 pt-4"><p className="text-xs uppercase tracking-wider text-slate-500">Current playstyle</p><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-xl font-semibold text-white">{ps.label}</span>{ps.provisional && <Badge tone="amber" title="Fewer than 3 matches. Labels settle as you play more.">provisional</Badge>}</div><p className="mt-1 text-xs text-slate-500">{STYLE_BLURB[ps.label]}</p></div>
          </Card>
        </div>
        <Card className="mt-4"><div className="mb-2"><H2>Skill progression</H2><p className="text-xs text-slate-500">Track your defensive and offensive consistency match by match.</p></div>
          <div className="grid gap-6 lg:grid-cols-2">
            <LineChart ariaLabel="Block rate and contact rate per match" min={0} max={1} format={(n) => `${Math.round(n * 100)}%`} labels={labels} series={[{ label: 'Block rate', color: '#34d399', values: d.progression.map((p) => p.blockRate) }, { label: 'Contact rate', color: '#38bdf8', values: d.progression.map((p) => p.connectRate) }]} />
            <LineChart ariaLabel="Hit share per match" min={0} max={1} format={(n) => `${Math.round(n * 100)}%`} labels={labels} series={[{ label: 'Hit share', color: '#a3e635', values: d.progression.map((p) => p.damageShare) }]} />
          </div></Card>
        <Card className="mt-4"><div className="mb-3 flex items-center justify-between"><div><H2>Recent matches</H2><p className="-mt-2 text-xs text-slate-500">Your latest results and rating changes.</p></div><Link href="/matches" className="text-sm text-emerald-300 underline">All matches</Link></div>
          {matches.length === 0 ? <Empty>No matches found.</Empty> : <ul className="divide-y divide-ink-700">{matches.map((x) => (
            <li key={x.id}><Link href={`/matches/${x.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 transition hover:bg-ink-800/60">
              <span className="flex flex-wrap items-center gap-3"><ResultBadge r={x.result} /><span className="text-white">{x.character} vs {x.opponentCharacter}</span><span className="text-sm text-slate-500">{x.roundsWon}–{x.roundsLost}</span></span>
              <span className="flex items-center gap-3 text-sm text-slate-400">{x.ratingChange !== null && <span className={x.ratingChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(x.ratingChange)}</span>}<span>{when(x.playedAt)}</span></span></Link></li>))}</ul>}</Card>
      </>)}
    </Page>
  );
}
