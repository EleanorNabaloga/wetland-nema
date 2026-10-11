import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL is NOT set: this app would use local JSON files');
  process.exit(0);
}
console.log('USE_LOCAL_DEMO_FALLBACK =', process.env.USE_LOCAL_DEMO_FALLBACK ?? '(not set)');
console.log('Database host:', new URL(url).host);

const c = new pg.Client({ connectionString: url });
try {
  await c.connect();
  const n = await c.query('select count(*)::int as n from reports');
  console.log('Reports in the database:', n.rows[0].n);
  const s = await c.query('select status, count(*)::int as n from reports group by status order by n desc');
  console.log('By status:', s.rows.map((r) => r.status + '=' + r.n).join(', '));
  const ids = await c.query('select id from reports order by received_at desc limit 5');
  console.log('Newest report ids:', ids.rows.map((r) => r.id).join(', '));
  const col = await c.query("select 1 from information_schema.columns where table_name = 'reports' and column_name = 'phash'");
  console.log('Duplicate-detection migration applied:', col.rowCount > 0 ? 'yes' : 'NO');
  const t = await c.query("select to_regclass('public.reporter_trust') as t");
  console.log('Trust table exists yet:', t.rows[0].t ? 'yes' : 'not yet (created on first use)');
} catch (e) {
  console.log('FAILED:', e.message);
} finally {
  await c.end().catch(() => {});
}
