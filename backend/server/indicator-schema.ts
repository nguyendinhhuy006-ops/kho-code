import type { createDatabase } from './database.ts';

// Add nullable fields so existing KPI records remain valid without rewriting their values.
export async function initializeIndicatorSchema(db: ReturnType<typeof createDatabase>) {
  await db.transaction(async () => {
    const storage = await db.storageInfo();
    if (storage.mode !== 'relational') return;
    const schema = storage.schema.replaceAll(']', ']]');
    for (const [column, type] of [['LoaiChiTieu', 'nvarchar(20)'], ['MucTieuOKR', 'nvarchar(2000)'], ['MaMucTieuOKR', 'nvarchar(128)'], ['HanHoanThanh', 'nvarchar(10)']]) {
      await db.query(`IF COL_LENGTH(@arg1,@arg2) IS NULL ALTER TABLE [${schema}].[KPI] ADD [${column}] ${type} NULL`, [`${storage.schema}.KPI`, column]);
    }
  });
}
