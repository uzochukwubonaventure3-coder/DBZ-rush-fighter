import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api, guard, requireSession } from '@/lib/api';
import { num1, pct, signed, when } from '@/lib/format';
import type { MatchDetail, PlayerReplay } from '@/lib/types';
import { ActionButton, AutoRefresh, CopyButton } from '@/components/client';
import { PairedBars } from '@/components/charts';
import { Badge, Card, ErrorBox, H2, Page, ResultBadge, Stat } from '@/components/ui';
export const metadata: Metadata = { title: 'Match' };
export const dynamic = 'force-dynamic';

const hold = (p: PlayerReplay) => p.longestBlockHold ? `${p.longestBlockHold.seconds}s (ticks ${p.longestBlockHold.startTick}–${p.longestBlockHold.endTick})` : 'none';
const burst = (p: PlayerReplay) => p.peakAttackBurst ? `${p.peakAttackBurst.presses} presses (ticks ${p.peakAttackBurst.startTick}–${p.peakAttackBurst.endTick})` : 'none';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireSession();
  const r = guard(await api<MatchDetail>(`/v1/matches/${encodeURIComponent(id)}`, { token }));
  if (r.status === 404) notFound();
  if (!r.ok || !r.data) return <Page title="Match"><ErrorBox>{r.error}</ErrorBox></Page>;
  const m = r.data, c = m.coaching, f = m.features;
  const opp = m.opponent.registered && m.opponent.username ? m.opponent.username : 'Guest / CPU';
  const won = (x: boolean | null) => (x === null ? 'Draw' : x ? 'Won' : 'Lost');

  return (
    <Page title={`${m.you.character} vs ${m.opponent.character}`} subtitle={`${when(m.playedAt)} · against ${opp}`}
      action={<div className="flex items-center gap-2"><ResultBadge r={m.result} />{m.rating ? <Badge tone={m.rating.change >= 0 ? 'green' : 'red'}>Elo {signed(m.rating.change)} → {m.rating.after}</Badge> : <Badge title="Rated only between two registered players">unrated</Badge>}</div>}>
      <AutoRefresh active={c?.status === 'pending'} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <H2>Coaching report</H2>
          {!c || c.status === 'pending' || !c.content ? <p className="text-slate-400" role="status">Generating your report…</p> : (<div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {c.source?.startsWith('llm:') ? <Badge tone="blue">AI coach · {c.source.slice(4)}</Badge> : <Badge tone="slate" title="Deterministic rules applied to your match numbers. Not a language model.">Rule-based coach (not AI)</Badge>}
              {c.status === 'fallback' && <Badge tone="amber">AI coach unavailable, showing rule-based report</Badge>}
            </div>
            {c.status === 'fallback' && c.error && <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">Temporary diagnostic: {c.error}</p>}
            <p className="text-lg text-white">{c.content.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><h3 className="mb-1 text-sm font-semibold text-emerald-300">Strengths</h3><ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{c.content.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              <div><h3 className="mb-1 text-sm font-semibold text-rose-300">Work on</h3><ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{c.content.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            </div>
            <div><h3 className="mb-1 text-sm font-semibold text-ember-400">Practise before the next session</h3><ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">{c.content.drills.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
            {c.status === 'fallback' && <ActionButton url={`/api/matches/${m.id}/coaching-retry`} label="Retry AI coach" busyLabel="Retrying…" />}
          </div>)}
        </Card>
        <Card>
          <H2>This match</H2>
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Attacks / min" value={num1(f.attacksPerMin)} /><Stat label="Block rate" value={pct(f.blockRate)} />
            <Stat label="Contact rate" value={pct(f.connectRate)} /><Stat label="Hit share" value={pct(f.damageShare)} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">Block rate: share of attacks that reached you which you blocked. Contact rate: share of your attacks that landed or were blocked.</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-x-auto">
        <H2>Rounds</H2>
        <table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-400"><tr><th className="py-2 pr-4">Round</th><th className="pr-4">Result</th><th className="pr-4">Hits landed</th><th className="pr-4">Hits taken</th><th className="pr-4">Blocks</th><th className="pr-4">Time</th><th>Finish</th></tr></thead>
          <tbody className="divide-y divide-ink-700">{m.rounds.map((x, i) => (<tr key={i}><td className="py-2 pr-4">{i + 1}</td><td className="pr-4">{won(x.won)}</td><td className="pr-4">{x.hitsLanded}</td><td className="pr-4">{x.hitsTaken}</td><td className="pr-4">{x.blocks}</td><td className="pr-4">{x.durationSec}s</td><td>{x.finishingMove}</td></tr>))}</tbody></table>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-300">{Object.entries(m.you.style).map(([k, v]) => <div key={k}><dt className="inline text-slate-500">{k}: </dt><dd className="inline text-white">{v}</dd></div>)}</dl>
      </Card>

      <Card className="mt-4">
        <H2>Replay</H2>
        {!m.replay.available ? <p className="text-sm text-slate-400">No replay was saved for this match. The game uploads a replay only when you choose to save it.</p> : (() => { const ins = m.replay.insights; return (<div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {([['You', ins.you], ['Opponent', ins.opponent]] as const).map(([who, p]) => (
              <div key={who} className="rounded-lg bg-ink-800/60 p-3 text-sm"><div className="mb-2 font-semibold text-white">{who}</div>
                <div className="space-y-1 text-slate-300"><div>Attack presses: <b className="text-white">{p.attackPresses}</b></div><div>Block presses: <b className="text-white">{p.blockPresses}</b></div><div>Longest block hold: <b className="text-white">{hold(p)}</b></div><div>Busiest second: <b className="text-white">{burst(p)}</b></div></div></div>))}
          </div>
          <PairedBars data={ins.activity} ariaLabel="Attack presses per 5 seconds, you versus opponent" />
          <p className="text-xs text-slate-500">{ins.note} Ticks are game frames at 60 per second, from the start of the recording ({ins.durationSec}s).</p>
          <div className="rounded-lg border border-ink-600 p-3 text-sm">
            <p className="mb-2 text-slate-300">The dashboard can’t launch the game from the browser. To watch this match: download the file into the game’s <code>replays</code> folder, then run:</p>
            <div className="flex flex-wrap items-center gap-2"><code className="break-all rounded bg-ink-950 px-2 py-1">dbs_game.exe --replay replays/{m.gameMatchId}.json</code><CopyButton text={`dbs_game.exe --replay replays/${m.gameMatchId}.json`} /></div>
            <a className="mt-3 inline-block rounded bg-ember-500 px-3 py-1.5 font-semibold text-ink-950 hover:bg-ember-400" href={`/api/matches/${m.id}/replay`} download>Download replay file</a>
          </div>
        </div>); })()}
      </Card>
      <p className="mt-6"><Link href="/matches" className="text-sm text-ember-400 underline">← All matches</Link></p>
    </Page>
  );
}
