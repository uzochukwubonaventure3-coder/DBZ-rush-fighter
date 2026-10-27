import Link from 'next/link';
import type { Metadata } from 'next';
import { api, guard, requireSession } from '@/lib/api';
import { STYLE_BLURB, num1, pct, signed, when } from '@/lib/format';
import type { MatchRow, Overview } from '@/lib/types';
import { FadeIn } from '@/components/client';
import { LineChart } from '@/components/charts';
import { Badge, Card, Empty, ErrorBox, H2, Page, ResultBadge, Stat } from '@/components/ui';
export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const token = await requireSession();
  const [o, m] = await Promise.all([guard(await api<Overview>('/v1/me/overview', { token })), guard(await api<{ matches: MatchRow[] }>('/v1/matches?limit=5', { token }))]);
  if (!o.ok || !o.data) return <Page title="Dashboard"><ErrorBox>{o.error}</ErrorBox></Page>;
  const d = o.data, ps = d.playstyle, f = ps.features, matches = m.data?.matches ?? [];
  const labels = d.progression.map((p) => new Date(p.playedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
  return (
    <Page title={`Welcome, ${d.player.username}`} subtitle="Your rating, playstyle and progress.">
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn><Card className="h-full"><Stat label="Elo rating" value={<span className="text-ember-400">{d.player.rating}</span>} hint={`${d.player.ratedMatches} rated matches · ${d.player.ratedWins} wins`} /></Card></FadeIn>
        <FadeIn delay={0.05}><Card className="h-full"><Stat label={d.record.window} value={`${d.record.wins}W · ${d.record.losses}L`} hint={d.record.undecided ? `${d.record.undecided} without a result` : `${d.record.matches} matches`} /></Card></FadeIn>
        <FadeIn delay={0.1}><Card className="h-full"><div className="text-xs uppercase tracking-wider text-slate-400">Playstyle</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">{d.record.matches === 0 ? '—' : ps.label}{ps.provisional && d.record.matches > 0 && <Badge tone="amber" title="Fewer than 3 matches. Labels settle as you play more.">provisional</Badge>}</div>
          <p className="mt-1 text-xs text-slate-500">{d.record.matches === 0 ? 'Play a match to get classified.' : STYLE_BLURB[ps.label]}</p></Card></FadeIn>
      </div>

      {d.record.matches === 0 ? <div className="mt-6"><Empty>No matches yet. Once the game uploads a match, your analytics appear here. Your ingest token is in <Link href="/settings" className="text-ember-400 underline">Settings</Link>.</Empty></div> : (<>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card><H2>Playstyle numbers (last {ps.matchesUsed})</H2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Attacks / min" value={num1(f.attacksPerMin)} /><Stat label="Block rate" value={pct(f.blockRate)} hint="incoming attacks you blocked" /><Stat label="Contact rate" value={pct(f.connectRate)} hint="your attacks that reached" />
              <Stat label="Hit share" value={pct(f.damageShare)} hint="clean hits that were yours" /><Stat label="Move variety" value={pct(f.variety)} /><Stat label="Jumps+crouches / min" value={num1(f.mobilityPerMin)} />
            </dl>
            <p className="mt-4 text-xs text-slate-500">Labels use provisional thresholds that have not yet been calibrated on real player data.</p></Card>
          <Card><H2>Elo rating over time</H2><LineChart ariaLabel="Elo rating over time" series={[{ label: 'Rating', color: '#ff9419', values: d.ratingHistory.map((r) => r.rating) }]} labels={d.ratingHistory.map((r) => new Date(r.playedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }))} format={(n) => String(Math.round(n))} />
            {d.ratingHistory.length === 0 && <p className="mt-2 text-xs text-slate-500">Ratings change only in rated matches between two registered players.</p>}</Card>
        </div>
        <Card className="mt-4"><H2>Skill progression</H2>
          <div className="grid gap-6 lg:grid-cols-2">
            <LineChart ariaLabel="Block rate and contact rate per match" min={0} max={1} format={(n) => `${Math.round(n * 100)}%`} labels={labels} series={[{ label: 'Block rate', color: '#38bdf8', values: d.progression.map((p) => p.blockRate) }, { label: 'Contact rate', color: '#ff9419', values: d.progression.map((p) => p.connectRate) }]} />
            <LineChart ariaLabel="Hit share per match" min={0} max={1} format={(n) => `${Math.round(n * 100)}%`} labels={labels} series={[{ label: 'Hit share', color: '#34d399', values: d.progression.map((p) => p.damageShare) }]} />
          </div></Card>
        <Card className="mt-4"><div className="mb-3 flex items-center justify-between"><H2>Recent matches</H2><Link href="/matches" className="text-sm text-ember-400 underline">All matches</Link></div>
          <ul className="divide-y divide-ink-700">{matches.map((x) => (
            <li key={x.id}><Link href={`/matches/${x.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-ink-800/60">
              <span className="flex items-center gap-3"><ResultBadge r={x.result} /><span className="text-white">{x.character} vs {x.opponentCharacter}</span><span className="text-sm text-slate-500">{x.roundsWon}–{x.roundsLost}</span></span>
              <span className="flex items-center gap-3 text-sm text-slate-400">{x.ratingChange !== null && <span className={x.ratingChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(x.ratingChange)}</span>}<span>{when(x.playedAt)}</span></span></Link></li>))}</ul></Card>
      </>)}
    </Page>
  );
}
