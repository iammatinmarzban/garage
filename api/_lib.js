import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = url ? neon(url) : null;

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || '');
const COOKIE = 'garage_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let ready;
export function init() {
  if (!sql) throw new Error('DATABASE_URL is not set');
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is not set');
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, make TEXT, model TEXT, year TEXT, mileage INT,
        created_at TIMESTAMPTZ DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL, date DATE NOT NULL, mileage INT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now())`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function startSession(res, uid) {
  const token = await new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`);
}

export function endSession(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

export async function getUid(req) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m.slice(COOKIE.length + 1), secret());
    return payload.uid || null;
  } catch { return null; }
}

export function fail(res, e) {
  console.error(e);
  const msg = String(e.message || '');
  const setup = msg.includes('is not set');
  res.status(500).json({ error: setup ? msg : 'Server error' });
}
