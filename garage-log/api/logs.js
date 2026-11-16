import { sql, init, getUid, fail } from './_lib.js';

const TYPES = ['oil', 'mechanic', 'wash', 'other'];

export default async function handler(req, res) {
  try {
    await init();
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Not signed in' });

    if (req.method === 'GET') {
      const vid = parseInt(req.query.vehicleId, 10);
      const rows = await sql`
        SELECT id, type, to_char(date,'YYYY-MM-DD') AS date, mileage, notes
        FROM logs WHERE vehicle_id = ${vid} AND user_id = ${uid}
        ORDER BY date DESC, id DESC`;
      return res.json({ logs: rows });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const vid = parseInt(b.vehicleId, 10);
      if (!TYPES.includes(b.type)) return res.status(400).json({ error: 'Bad type' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Bad date' });
      const own = await sql`SELECT id FROM vehicles WHERE id = ${vid} AND user_id = ${uid}`;
      if (!own[0]) return res.status(404).json({ error: 'Vehicle not found' });
      const mileage = b.mileage === '' || b.mileage == null ? null : Math.max(0, parseInt(b.mileage, 10) || 0);
      await sql`INSERT INTO logs (vehicle_id, user_id, type, date, mileage, notes)
                VALUES (${vid}, ${uid}, ${b.type}, ${b.date}, ${mileage}, ${String(b.notes || '').slice(0, 1000)})`;
      if (mileage != null)
        await sql`UPDATE vehicles SET mileage = GREATEST(COALESCE(mileage, 0), ${mileage}) WHERE id = ${vid}`;
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      await sql`DELETE FROM logs WHERE id = ${id} AND user_id = ${uid}`;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { fail(res, e); }
}
