import type { Metadata } from 'next';
import { api, guard, requireSession } from '@/lib/api';
import { LogoutButton, RotateToken } from '@/components/client';
import { Card, H2, Page } from '@/components/ui';
export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function Settings() {
  const token = await requireSession();
  const me = guard(await api<{ username: string }>('/v1/me', { token }));
  return (
    <Page title="Settings" subtitle={me.data ? `Signed in as ${me.data.username}` : undefined} action={<LogoutButton />}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><H2>Game ingest token</H2>
          <p className="mb-4 text-sm text-slate-300">The game sends this token with every match so results are credited to your account. Your original token was shown once at sign-up and can’t be displayed again. If you lost it, generate a new one; the old one stops working immediately.</p>
          <RotateToken /></Card>
        <Card><H2>For a second player</H2>
          <p className="text-sm text-slate-300">Matches count towards Elo only when both players are registered. If two people play on one computer, the second player’s own ingest token is sent alongside yours. Matches against the CPU or a guest are stored and coached but not rated.</p></Card>
      </div>
    </Page>
  );
}
