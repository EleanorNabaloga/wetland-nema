import pg from 'pg';

const confirm = process.argv.includes('--confirm');
const PLACEHOLDER = 'your-admin-email';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await c.connect();
  const r = await c.query('select email, role, status from staff_users where email = $1', [PLACEHOLDER]);
  if (!r.rowCount) {
    console.log('No placeholder account found. Nothing to do.');
  } else if (!confirm) {
    console.log('Would delete this account:', r.rows[0].email, '|', r.rows[0].role, '|', r.rows[0].status);
    console.log('Nothing was changed. Add --confirm to delete it.');
  } else {
    await c.query('delete from staff_users where email = $1', [PLACEHOLDER]);
    console.log('Deleted the placeholder account.');
  }
} catch (e) {
  console.log('FAILED:', e.message);
}
await c.end().catch(() => {});
