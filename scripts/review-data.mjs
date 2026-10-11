import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await c.connect();

  console.log('--- OFFICER ACCOUNTS ---');
  const u = await c.query('select email, role, status, totp_enabled from staff_users order by created_at');
  for (const r of u.rows) console.log(r.email + ' | ' + r.role + ' | ' + r.status + ' | MFA ' + (r.totp_enabled ? 'on' : 'OFF'));

  console.log('--- REPORTS (newest first) ---');
  const rep = await c.query("select id, type, left(coalesce(note, ''), 30) as note, status, to_char(received_at, 'YYYY-MM-DD HH24:MI') as received from reports order by received_at desc");
  for (const r of rep.rows) console.log(r.id + ' | ' + (r.type || '-') + ' | ' + (r.note || '-') + ' | ' + r.status + ' | ' + r.received);
} catch (e) {
  console.log('FAILED:', e.message);
}
await c.end().catch(() => {});
