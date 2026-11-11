import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import sql from 'mssql/msnodesqlv8.js';
import { relationalStore } from './relational-store.ts';

for (const name of ['.env.local', '.env.sqlserver.local']) {
  if (existsSync(resolve(name))) loadEnvFile(resolve(name));
}

const tableNames = new Set(['state', 'credentials', 'sessions', 'attempts']);
export function createDatabase(connectionString = process.env.SQLSERVER_CONNECTION_STRING,
  schema = process.env.DATABASE_SCHEMA ?? process.env.SQLSERVER_SCHEMA ?? 'quantrikpi_app') {
  if (!connectionString) throw new Error('Thiếu SQLSERVER_CONNECTION_STRING. Xem server/SQLSERVER.md.');
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Tên schema SQL Server không hợp lệ.');
  if (schema === 'dbo') throw new Error('Dùng schema riêng để bảo vệ các bảng dbo hiện có.');
  if (process.env.NODE_ENV === 'test' && !/^(test_|e2e_)/.test(schema)) throw new Error('Kiểm thử phải dùng schema test_ hoặc e2e_ riêng.');
  const config = { connectionString, server: '.', connectionTimeout: 5_000, requestTimeout: 20_000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 } };
  const pool = new sql.ConnectionPool(config);
  pool.on('error', () => console.error('Kết nối SQL Server gặp lỗi.'));
  let connecting: Promise<sql.ConnectionPool> | undefined;
  const connected = () => connecting ??= pool.connect();
  const context = new AsyncLocalStorage<sql.Transaction>();
  let storageChecked = false;
  let relational: ReturnType<typeof relationalStore> | undefined;
  let relationalSchema: string | undefined;
  async function loadStorage() {
    if (!storageChecked) {
      const result = await query(`IF OBJECT_ID(N'${schema}.storage_config',N'U') IS NOT NULL
        SELECT target_schema FROM [${schema}].[storage_config] WHERE id=1`);
      const target = result.rows[0]?.target_schema as string | undefined;
      if (target) {
        if (!/^[a-z][a-z0-9_]{0,62}$/.test(target)) throw new Error('Invalid relational storage schema.');
        if (process.env.NODE_ENV === 'test' && !/^(test_|e2e_)/.test(target)) throw new Error('Test storage must use an isolated schema.');
        relationalSchema = target;
        relational = relationalStore(query, target);
      }
      storageChecked = true;
    }
    return relational;
  }
  const table = (name: string) => {
    if (!tableNames.has(name)) throw new Error('Tên bảng không được hỗ trợ.');
    if (name === 'credentials' && relational) return relational.table('ThongTinDangNhap');
    return `[${schema}].[${name}]`;
  };
  async function query(statement: string, values: unknown[] = []) {
    await connected();
    if (statement.includes('{{credentials}}')) await loadStorage();
    const transaction = context.getStore();
    const request = transaction ? new sql.Request(transaction) : new sql.Request(pool);
    values.forEach((value, index) => {
      if (Buffer.isBuffer(value)) request.input(`arg${index + 1}`, sql.VarBinary(sql.MAX), value);
      else if (typeof value === 'number' && Number.isSafeInteger(value)) request.input(`arg${index + 1}`, sql.BigInt, value);
      else if (typeof value === 'boolean') request.input(`arg${index + 1}`, sql.Bit, value);
      else request.input(`arg${index + 1}`, sql.NVarChar(sql.MAX), value == null ? null : String(value));
    });
    // Explicit placeholders keep every application query in its own schema.
    const qualified = statement.replace(/\{\{([a-z_]+)\}\}/g, (_, name: string) => table(name));
    const result = await request.query(qualified);
    const rows = result.recordset ?? [];
    return { rows, rowCount: result.recordset ? rows.length : result.rowsAffected.reduce((a, b) => a + b, 0) };
  }
  const db = {
    schema, table, query,
    async initialize() {
      await connected();
      if (await loadStorage()) return;
      await db.transaction(async () => {
        await query(`IF SCHEMA_ID(N'${schema}') IS NULL EXEC(N'CREATE SCHEMA [${schema}] AUTHORIZATION [dbo]');
          IF OBJECT_ID(N'${schema}.state', N'U') IS NULL
            CREATE TABLE ${table('state')} (id INT PRIMARY KEY CHECK(id=1), json NVARCHAR(MAX) NOT NULL CHECK(ISJSON(json)=1));
          IF OBJECT_ID(N'${schema}.credentials', N'U') IS NULL
            CREATE TABLE ${table('credentials')} (user_id NVARCHAR(128) PRIMARY KEY, salt VARCHAR(128) NOT NULL, hash VARCHAR(128) NOT NULL);
          IF OBJECT_ID(N'${schema}.sessions', N'U') IS NULL BEGIN
            CREATE TABLE ${table('sessions')} (token_hash VARCHAR(64) PRIMARY KEY, user_id NVARCHAR(128) NOT NULL, expires BIGINT NOT NULL);
            CREATE INDEX sessions_user_id_idx ON ${table('sessions')}(user_id);
            CREATE INDEX sessions_expires_idx ON ${table('sessions')}(expires);
          END;
          IF OBJECT_ID(N'${schema}.attempts', N'U') IS NULL
            CREATE TABLE ${table('attempts')} ([key] VARCHAR(64) PRIMARY KEY, [count] INT NOT NULL, until_time BIGINT NOT NULL);`);
      });
    },
    async readStore() {
      const storage = await loadStorage();
      if (storage) return db.transaction(() => storage.read());
      const result = await query('SELECT json FROM {{state}} WHERE id=1');
      return result.rows[0] ? JSON.parse(result.rows[0].json) : undefined;
    },
    async writeStore(value: unknown) {
      const storage = await loadStorage();
      if (storage) return db.transaction(() => storage.write(value));
      await query(`UPDATE {{state}} SET json=@arg1 WHERE id=1;
        IF @@ROWCOUNT=0 INSERT INTO {{state}}(id,json) VALUES(1,@arg1);`, [JSON.stringify(value)]);
    },
    async setCredential(userId: string, salt: string, hash: string) {
      await query(`UPDATE {{credentials}} SET salt=@arg2,hash=@arg3 WHERE user_id=@arg1;
        IF @@ROWCOUNT=0 INSERT INTO {{credentials}}(user_id,salt,hash) VALUES(@arg1,@arg2,@arg3);`, [userId, salt, hash]);
    },
    async recordFailure(key: string) {
      const now = Date.now();
      await query(`UPDATE {{attempts}} SET [count]=CASE WHEN until_time < @arg3 THEN 1 ELSE [count]+1 END,
        until_time=CASE WHEN until_time < @arg3 THEN @arg2 ELSE until_time END WHERE [key]=@arg1;
        IF @@ROWCOUNT=0 INSERT INTO {{attempts}}([key],[count],until_time) VALUES(@arg1,1,@arg2);`, [key, now + 15 * 60_000, now]);
    },
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      if (context.getStore()) return work();
      await connected();
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      try {
        const lock = new sql.Request(transaction);
        lock.input('resource', sql.NVarChar(255), `quantrikpi:${schema}`);
        await lock.query(`DECLARE @result INT;
          EXEC @result=sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
          IF @result < 0 THROW 50001, 'Cannot acquire application database lock', 1;`);
        const result = await context.run(transaction, work);
        await transaction.commit();
        return result;
      } catch (error) { await transaction.rollback().catch(() => {}); throw error; }
    },
    async close() { if (connecting) { await connecting.catch(() => {}); await pool.close(); } },
    async storageInfo() { await loadStorage(); return { mode: relational ? 'relational' : 'json', schema: relationalSchema ?? schema }; },
    async refreshStorage() { storageChecked = false; relational = undefined; relationalSchema = undefined; return loadStorage(); },
  };
  return db;
}
