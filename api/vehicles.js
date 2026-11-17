import { sql, init, getUid, fail } from './_lib.js';

export default async function handler(req, res) {
  try {
    await init();
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Not signed in' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT v.id, v.name, v.make, v.model, v.year, v.mileage,
          (SELECT to_char(max(date),'YYYY-MM-DD') FROM logs l WHERE l.vehicle_id=v.id AND l.type='oil') AS last_oil,
          (SELECT to_char(max(date),'YYYY-MM-DD') FROM logs l WHERE l.vehicle_id=v.id AND l.type='mechanic') AS last_mechanic,
          (SELECT to_char(max(date),'YYYY-MM-DD') FROM logs l WHERE l.vehicle_id=v.id AND l.type='wash') AS last_wash
        FROM vehicles v WHERE v.user_id = ${uid} ORDER BY v.id`;
      return res.json({ vehicles: rows });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const name = String(b.name || '').trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const mileage = b.mileage === '' || b.mileage == null ? null : Math.max(0, parseInt(b.mileage, 10) || 0);
      const r = await sql`
        INSERT INTO vehicles (user_id, name, make, model, year, mileage)
        VALUES (${uid}, ${name}, ${String(b.make || '').slice(0, 60)}, ${String(b.model || '').slice(0, 60)},
                ${String(b.year || '').slice(0, 8)}, ${mileage}) RETURNING id`;
      return res.json({ id: r[0].id });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      await sql`DELETE FROM vehicles WHERE id = ${id} AND user_id = ${uid}`;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { fail(res, e); }
}
