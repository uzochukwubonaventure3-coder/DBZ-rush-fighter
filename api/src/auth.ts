import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = (prefix: 'dbzs' | 'dbzi') => `${prefix}_${randomBytes(32).toString('base64url')}`;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await scrypt(pw, salt, 64)).toString('base64')}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, h] = stored.split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const expected = Buffer.from(h, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
