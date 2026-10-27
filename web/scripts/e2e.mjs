// End-to-end: real API process + real `next start` process, real HTTP, the game's real sample_stats.json.
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = 'http://localhost:4011', WEB = 'http://localhost:3011';
const sample = JSON.parse(readFileSync(new URL('../../contracts/fixtures/real_game_output.sample_stats.json', import.meta.url), 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
const procs = [];
const start = (cmd, args, env, cwd) => { const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: 'ignore', detached: true }); procs.push(p); return p; };
const stopAll = () => { for (const p of procs) { try { process.kill(-p.pid); } catch {} } rmSync(dir, { recursive: true, force: true }); };
const wait = async (url) => { for (let i = 0; i < 90; i++) { try { if ((await fetch(url)).status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 1000)); } throw new Error('did not start: ' + url); };

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  <-- ' + extra}`); };
const web = (path, o = {}) => fetch(WEB + path, { redirect: 'manual', ...o, headers: { ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.headers ?? {}) } });
const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('dbz_session=')) ?? '';

try {
  start('npx', ['tsx', 'src/server.ts'], { PORT: '4011', PGLITE_DIR: join(dir, 'db') }, '../api');
  start('npx', ['next', 'start', '-p', '3011'], { API_URL: API }, '.');
  await wait(API + '/v1/health'); await wait(WEB + '/login');

  // --- public pages
  let r = await web('/'); let html = await r.text();
  check('landing page renders', r.status === 200 && html.includes('Know exactly how to win'), r.status);
  check('landing shows empty-leaderboard message before any rated match', html.includes('No rated matches yet'));
  r = await web('/dashboard'); check('dashboard without a session redirects to /login', r.status >= 300 && r.status < 400 && (r.headers.get('location') ?? '').includes('/login'), `${r.status} ${r.headers.get('location')}`);
  r = await web('/matches'); check('matches without a session redirects to /login', r.status >= 300 && r.status < 400);
  r = await web('/api/matches/abc/replay'); check('replay download without session is 401', r.status === 401, r.status);

  // --- register two players through the web app (the real browser path)
  const reg = async (u) => { const res = await web('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: 'correct-horse-9' }) }); const j = await res.json(); return { res, j, cookie: cookieOf(res) }; };
  const A = await reg('e2e_alice'), B = await reg('e2e_bob'), C = await reg('e2e_carol');
  check('register returns 201 + one-time ingest token', A.res.status === 201 && /^dbzi_/.test(A.j.ingestToken));
  const setCookie = A.res.headers.getSetCookie().join(';').toLowerCase();
  check('session cookie is HttpOnly + SameSite=Lax and never in the JSON body', setCookie.includes('httponly') && setCookie.includes('samesite=lax') && !JSON.stringify(A.j).includes('dbzs_'));
  const dup = await reg('E2E_ALICE'); check('duplicate username rejected with message', dup.res.status === 409 && /taken/.test(dup.j.error), dup.res.status);
  const weak = await web('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'zed_zed', password: 'x' }) }); check('weak password rejected', weak.status === 422);
  const bad = await web('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'e2e_alice', password: 'wrong-password' }) }); check('wrong password -> 401', bad.status === 401);
  check('malformed login body -> 400', (await web('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' })).status === 400);

  // --- dashboard before any match
  r = await web('/dashboard', { cookie: A.cookie }); html = await r.text();
  check('empty dashboard shows the no-matches state', r.status === 200 && html.includes('Welcome, e2e_alice') && html.includes('No matches yet'));

  // --- the game uploads the real sample (Alice at the keyboard, Bob as player 2)
  const up = await fetch(API + '/v1/matches', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${A.j.ingestToken}`, 'x-player2-token': B.j.ingestToken }, body: JSON.stringify(sample) });
  const upj = await up.json(); check('game upload accepted (201, rated, +16/-16)', up.status === 201 && upj.rated && upj.ratings.p1.after === 1216 && upj.ratings.p2.after === 1184, JSON.stringify(upj));
  const again = await fetch(API + '/v1/matches', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${A.j.ingestToken}`, 'x-player2-token': B.j.ingestToken }, body: JSON.stringify(sample) });
  check('duplicate upload is 200 and does not re-rate', again.status === 200 && (await again.json()).duplicate === true);
  await new Promise((r) => setTimeout(r, 1500)); // let coaching finish

  // --- pages with data
  r = await web('/dashboard', { cookie: A.cookie }); html = await r.text();
  check('dashboard shows rating 1216', html.includes('1216'));
  check('dashboard shows playstyle label with provisional flag', html.includes('Aggressive') && html.includes('provisional'), 'label/provisional missing');
  check('dashboard renders SVG charts', (html.match(/<svg/g) ?? []).length >= 2);
  r = await web('/matches', { cookie: A.cookie }); html = await r.text();
  const plain = html.replace(/<!--.*?-->/g, '');   // React separates adjacent text nodes with <!-- -->
  const missing = ['Broly vs Vegeta', 'WIN', '+16', 'e2e_bob'].filter((t) => !plain.includes(t));
  check('match history lists Broly vs Vegeta, WIN, +16, opponent e2e_bob', missing.length === 0, 'missing: ' + missing.join(', ') + ' | raw has comment-split: ' + html.includes('Broly<!-- --> vs'));
  const list = await (await fetch(API + '/v1/matches', { headers: { authorization: 'Bearer ' + decodeURIComponent(A.cookie.split('=')[1]) } })).json();
  const mid = list.matches[0].id;
  r = await web('/matches/' + mid, { cookie: A.cookie }); html = await r.text();
  check('match detail shows coaching labelled "Rule-based coach (not AI)"', r.status === 200 && html.includes('Rule-based coach (not AI)') && html.includes('Practise before the next session'));
  check('match detail shows no replay yet', html.includes('No replay was saved'));
  r = await web('/matches/' + mid, { cookie: B.cookie }); html = await r.text();
  check("bob sees the same match as a LOSS with -16", html.includes('LOSS') && html.includes('-16'));
  r = await web('/matches/' + mid, { cookie: C.cookie }); check("a stranger gets 404 for someone else's match", r.status === 404, r.status);
  r = await web('/matches/not-a-uuid', { cookie: A.cookie }); check('invalid match id -> 404', r.status === 404, r.status);

  // --- replay
  const total = sample.rounds.reduce((a, x) => a + x.duration_sec, 0) * 60 + 600;
  const replay = { match_id: sample.match_id, fps: 60, total_frames: total, p1_character: 'Broly', p2_character: 'Vegeta', frames: [{ f: 10, p1: ['right'], p2: ['left'] }, { f: 100, p1: ['punch'], p2: ['block'] }, { f: 104, p1: [], p2: ['block'] }, { f: 110, p1: ['kick'], p2: ['block'] }, { f: 300, p1: ['block'], p2: ['punch'] }, { f: 560, p1: [], p2: [] }] };
  const rp = await fetch(`${API}/v1/matches/by-game-id/${sample.match_id}/replay`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${A.j.ingestToken}` }, body: JSON.stringify(replay) });
  check('replay upload accepted (201)', rp.status === 201, rp.status);
  await new Promise((r) => setTimeout(r, 1500));
  r = await web('/matches/' + mid, { cookie: A.cookie }); html = await r.text();
  check('detail now shows replay insights + inputs-only caveat', html.includes('Longest block hold') && html.includes('button presses only') || html.includes('inputs') || html.includes('Derived from recorded button presses'));
  check('detail shows the game command for the replay', html.includes('dbs_game.exe --replay replays/' + sample.match_id + '.json'));
  r = await web(`/api/matches/${mid}/replay`, { cookie: A.cookie });
  check('replay download returns the file with an attachment header', r.status === 200 && (r.headers.get('content-disposition') ?? '').includes(sample.match_id + '.json') && (await r.json()).fps === 60);
  r = await web(`/api/matches/${mid}/replay`, { cookie: C.cookie }); check("stranger cannot download someone else's replay", r.status === 404, r.status);

  // --- leaderboard
  r = await web('/leaderboard'); html = await r.text();
  check('leaderboard ranks alice 1216 above bob 1184', html.indexOf('e2e_alice') > 0 && html.indexOf('e2e_alice') < html.indexOf('e2e_bob') && /1,?216/.test(html) && /1,?184/.test(html));
  r = await web('/'); html = await r.text(); check('landing top-players now lists alice', html.includes('e2e_alice'));

  // --- secrets never reach the browser
  r = await web('/dashboard', { cookie: A.cookie }); html = await r.text();
  const sess = decodeURIComponent(A.cookie.split('=')[1]);
  check('no session token, ingest token, or API URL appears in any page HTML', !html.includes(sess) && !html.includes(A.j.ingestToken) && !html.includes('localhost:4011'));

  // --- settings + token rotation + logout
  r = await web('/settings', { cookie: A.cookie }); check('settings renders', r.status === 200 && (await r.text()).includes('Game ingest token'));
  const rot = await web('/api/me/rotate-token', { method: 'POST', cookie: A.cookie }); const rotj = await rot.json();
  const oldTok = await fetch(API + '/v1/matches', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${A.j.ingestToken}` }, body: JSON.stringify(sample) });
  check('rotating the token invalidates the old one', rot.status === 200 && /^dbzi_/.test(rotj.ingestToken) && oldTok.status === 401);
  const out = await web('/api/auth/logout', { method: 'POST', cookie: A.cookie });
  const stale = await fetch(API + '/v1/me', { headers: { authorization: 'Bearer ' + sess } });
  check('logout clears the cookie and ends the session server-side', out.status === 200 && /dbz_session=;|max-age=0|expires=/i.test(out.headers.getSetCookie().join(';')) && stale.status === 401);
  r = await web('/dashboard', { cookie: A.cookie }); check('a stale cookie is bounced to /login', r.status >= 300 && r.status < 400);

  // --- page weight (3G goal): gzip of HTML + all JS the page references
  const weigh = async (path, cookie) => { const res = await web(path, { cookie }); const h = await res.text(); const srcs = [...new Set([...h.matchAll(/src="(\/_next\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]))]; let js = 0; for (const s of srcs) js += gzipSync(Buffer.from(await (await fetch(WEB + s)).arrayBuffer())).length; return { path, html_gz_kb: +(gzipSync(h).length / 1024).toFixed(1), js_gz_kb: +(js / 1024).toFixed(1) }; };
  const login2 = await web('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'e2e_bob', password: 'correct-horse-9' }) });
  console.table([await weigh('/'), await weigh('/leaderboard'), await weigh('/login'), await weigh('/dashboard', cookieOf(login2)), await weigh('/matches/' + mid, cookieOf(login2))]);
} catch (e) { fail++; console.log('FAIL  harness error:', e); }
finally { stopAll(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
