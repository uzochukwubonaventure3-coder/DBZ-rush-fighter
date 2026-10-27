/** npm run db:check : connects with DATABASE_URL, applies the schema, and reports what it found. */
import { createDbFromEnv } from '../src/db';

const url = process.env.DATABASE_URL;
console.log(url ? `Connecting to Postgres at ${new URL(url).host} ...` : 'DATABASE_URL is blank: using local PGlite (not Supabase).');
try {
  const db = await createDbFromEnv();
  const v = (await db.query<{ v: string }>('SELECT version() AS v')).rows[0].v;
  const t = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('players','sessions','matches','replays','coaching')")).rows[0].n;
  console.log(`OK: ${v.split(',')[0]}`);
  console.log(`Schema tables present: ${t} of 5 ${t === 5 ? '(ready)' : '(UNEXPECTED)'}`);
  await db.close();
  process.exit(t === 5 ? 0 : 1);
} catch (e: any) {
  const m = String(e?.message ?? e);
  console.error('FAILED:', m);
  if (/ENOTFOUND|ENETUNREACH|EHOSTUNREACH|EADDRNOTAVAIL/.test(m + (e?.code ?? ''))) console.error('Hint: the direct Supabase host is IPv6-only. Use the "Session pooler" string from Connect instead.');
  if (/password authentication|SASL/i.test(m)) console.error('Hint: wrong password, or special characters in it need URL-encoding.');
  process.exit(1);
}
