const { Client } = require('pg');
const client = new Client({
  host: 'db.haksqgakssvmlbxtqxir.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'Thanhdatcan5@gmail.com',
  ssl: { rejectUnauthorized: false },
});
async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT id, full_name, email, role
    FROM profiles
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.table(res.rows);
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
