import bcrypt from 'bcryptjs';
import { sql, init, startSession, endSession, getUid, fail } from './_lib.js';

export default async function handler(req, res) {
  try {
    await init();

    if (req.method === 'GET') {
      const uid = await getUid(req);
      if (uid) {
        const r = await sql`SELECT username FROM users WHERE id = ${uid}`;
        if (r[0]) return res.json({ user: r[0].username, canRegister: false });
      }
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
      return res.json({ user: null, canRegister: n === 0 });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, username, password } = req.body || {};

    if (action === 'logout') { endSession(res); return res.json({ ok: true }); }

    const name = String(username || '').trim().toLowerCase();
    const pw = String(password || '');

    if (action === 'register') {
      // Single-owner app: only the very first account can be created.
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
      if (n > 0) return res.status(403).json({ error: 'Registration is closed' });
      if (!/^[a-z0-9_.-]{3,32}$/.test(name))
        return res.status(400).json({ error: 'Username: 3-32 letters, numbers, . _ -' });
      if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const hash = await bcrypt.hash(pw, 10);
      const r = await sql`INSERT INTO users (username, password_hash) VALUES (${name}, ${hash}) RETURNING id`;
      await startSession(res, r[0].id);
      return res.json({ user: name });
    }

    if (action === 'login') {
      const r = await sql`SELECT id, password_hash FROM users WHERE username = ${name}`;
      const ok = r[0] && (await bcrypt.compare(pw, r[0].password_hash));
      if (!ok) {
        await new Promise((s) => setTimeout(s, 600)); // slow down guessing
        return res.status(401).json({ error: 'Wrong username or password' });
      }
      await startSession(res, r[0].id);
      return res.json({ user: name });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { fail(res, e); }
}
