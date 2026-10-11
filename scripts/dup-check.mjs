import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await c.connect();
  const r = await c.query(`select id, left(coalesce(note, ''), 14) as note, dup_status, dup_reason, dup_of, dup_distance, case_id,
                                  round(lat::numeric, 4) as lat, round(lng::numeric, 4) as lng,
                                  to_char(received_at, 'HH24:MI') as at
                           from reports order by received_at desc limit 6`);
  for (const x of r.rows) {
    console.log([x.id, x.at, x.note || '-', 'status=' + x.dup_status, 'reason=' + (x.dup_reason || '-'),
      'of=' + (x.dup_of || '-'), 'distance=' + (x.dup_distance ?? '-'), 'case=' + x.case_id, x.lat + ',' + x.lng].join(' | '));
  }
} catch (e) {
  console.log('FAILED:', e.message);
}
await c.end().catch(() => {});
