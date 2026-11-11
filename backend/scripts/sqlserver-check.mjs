import { createDatabase } from '../server/database.ts';
const db = createDatabase();
try {
  const result = await db.query('SELECT DB_NAME() AS database_name, CONVERT(varchar(30),SERVERPROPERTY(\'ProductVersion\')) AS version');
  console.log(JSON.stringify({ ...result.rows[0], schema: db.schema, connected: true }));
} finally { await db.close(); }
