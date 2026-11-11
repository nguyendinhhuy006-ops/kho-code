import type { Store, AccessPolicy } from '../src/shared/domain.ts';

type Query = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
type Field = readonly [property: string, column: string, type: string, required?: boolean];
type Entity = { key: keyof Store; table: string; fields: readonly Field[] };
const id = 'nvarchar(128)';
const text = 'nvarchar(2000)';
export const entities: readonly Entity[] = [
  { key: 'units', table: 'DonVi', fields: [['id', 'MaDonVi', id, true], ['name', 'TenDonVi', text, true]] },
  { key: 'years', table: 'NamHoc', fields: [['id', 'MaNamHoc', id, true], ['name', 'TenNamHoc', text, true]] },
  { key: 'users', table: 'TaiKhoan', fields: [['id', 'MaTaiKhoan', id, true], ['name', 'HoTen', text, true], ['email', 'Email', 'nvarchar(200)', true], ['role', 'VaiTro', 'nvarchar(20)', true], ['unitId', 'MaDonVi', id, true], ['active', 'TrangThai', 'bit', true]] },
  { key: 'strategies', table: 'ChienLuoc', fields: [['id', 'MaChienLuoc', id, true], ['title', 'TenChienLuoc', text, true], ['description', 'MoTa', text, true], ['period', 'GiaiDoan', text], ['ownerUnitId', 'MaDonViChuTri', id], ['expectedOutcome', 'KetQuaKyVong', text]] },
  { key: 'plans', table: 'KeHoach', fields: [['id', 'MaKeHoach', id, true], ['title', 'TenKeHoach', text, true], ['unitId', 'MaDonVi', id, true], ['yearId', 'MaNamHoc', id, true], ['status', 'TrangThai', 'nvarchar(30)', true], ['reason', 'LyDo', text], ['strategyId', 'MaChienLuoc', id], ['objective', 'MucTieu', text], ['deliverables', 'SanPham', text], ['startDate', 'NgayBatDau', 'nvarchar(10)'], ['endDate', 'NgayKetThuc', 'nvarchar(10)'], ['reference', 'CanCu', text]] },
  { key: 'tasks', table: 'NhiemVu', fields: [['id', 'MaNhiemVu', id, true], ['title', 'TenNhiemVu', text, true], ['planId', 'MaKeHoach', id, true], ['assigneeId', 'MaTaiKhoan', id, true], ['due', 'HanHoanThanh', 'nvarchar(10)', true], ['progress', 'PhanTramHoanThanh', 'float', true], ['evidence', 'MinhChung', text, true], ['status', 'TrangThai', 'nvarchar(30)', true], ['reason', 'LyDo', text], ['description', 'MoTa', text], ['expectedOutput', 'SanPhamBanGiao', text], ['priority', 'MucDoUuTien', 'nvarchar(20)'], ['startDate', 'NgayBatDau', 'nvarchar(10)']] },
  { key: 'indicators', table: 'KPI', fields: [['id', 'MaKPI', id, true], ['title', 'TenKPI', text, true], ['userId', 'MaTaiKhoan', id, true], ['target', 'MucTieu', 'float', true], ['actual', 'KetQuaThucTe', 'float', true], ['unit', 'DonViTinh', text, true], ['status', 'TrangThai', 'nvarchar(30)', true], ['reason', 'LyDo', text], ['period', 'KyDanhGia', text], ['measurement', 'CachXacDinh', text], ['evidence', 'MinhChung', text], ['kind', 'LoaiChiTieu', 'nvarchar(20)'], ['objective', 'MucTieuOKR', text], ['objectiveId', 'MaMucTieuOKR', id], ['due', 'HanHoanThanh', 'nvarchar(10)']] },
  { key: 'logs', table: 'NhatKy', fields: [['id', 'MaNhatKy', id, true], ['actor', 'NguoiThucHien', text, true], ['action', 'HanhDong', text, true], ['time', 'ThoiGian', 'nvarchar(50)', true], ['entityId', 'MaDoiTuong', id], ['entityType', 'LoaiDoiTuong', text], ['title', 'TieuDe', text], ['detail', 'ChiTiet', text]] },
];
export const quote = (name: string) => `[${name.replaceAll(']', ']]')}]`;
export function relationalStore(query: Query, schema: string) {
  const table = (name: string) => `${quote(schema)}.${quote(name)}`;
  async function initialize() {
    await query(`IF SCHEMA_ID(@arg1) IS NULL EXEC('CREATE SCHEMA ${quote(schema)} AUTHORIZATION dbo')`, [schema]);
    for (const entity of entities) {
      await query(`CREATE TABLE ${table(entity.table)} (
        ${entity.fields.map(([, col, type, required], index) => `${quote(col)} ${type} ${required ? 'NOT NULL' : 'NULL'}${index === 0 ? ' PRIMARY KEY' : ''}`).join(',')},
        [ThuTu] int NOT NULL)`);
    }
    for (const [child, col, parent, parentCol] of [
      ['TaiKhoan', 'MaDonVi', 'DonVi', 'MaDonVi'],
      ['KeHoach', 'MaDonVi', 'DonVi', 'MaDonVi'], ['KeHoach', 'MaNamHoc', 'NamHoc', 'MaNamHoc'],
      ['NhiemVu', 'MaKeHoach', 'KeHoach', 'MaKeHoach'], ['NhiemVu', 'MaTaiKhoan', 'TaiKhoan', 'MaTaiKhoan'],
      ['KPI', 'MaTaiKhoan', 'TaiKhoan', 'MaTaiKhoan'],
    ]) await query(`ALTER TABLE ${table(child)} ADD FOREIGN KEY (${quote(col)}) REFERENCES ${table(parent)}(${quote(parentCol)});
      CREATE INDEX ${quote(`IX_${child}_${col}`)} ON ${table(child)}(${quote(col)})`);
    await query(`ALTER TABLE ${table('TaiKhoan')} ADD UNIQUE ([Email]), CHECK ([VaiTro] IN ('BGH','TDV','GV','ADMIN'));
      ALTER TABLE ${table('KeHoach')} ADD CHECK ([TrangThai] IN ('draft','submitted','approved','returned'));
      ALTER TABLE ${table('NhiemVu')} ADD CHECK ([PhanTramHoanThanh] BETWEEN 0 AND 100), CHECK ([TrangThai] IN ('assigned','working','review','accepted','revision'));
      ALTER TABLE ${table('KPI')} ADD CHECK ([MucTieu]>0 AND [KetQuaThucTe]>=0), CHECK ([TrangThai] IN ('draft','submitted','published'));
      CREATE TABLE ${table('CauHinhUngDung')} ([id] int PRIMARY KEY CHECK(id=1), [PhienBan] int NOT NULL, [PhienBanPhanQuyen] int NULL);
      CREATE TABLE ${table('TrangVaiTro')} ([VaiTro] nvarchar(20) NOT NULL, [Trang] nvarchar(100) NOT NULL, [ThuTu] int NOT NULL, PRIMARY KEY ([VaiTro],[Trang]));
      CREATE TABLE ${table('QuyenVaiTro')} ([VaiTro] nvarchar(20) NOT NULL, [Quyen] nvarchar(100) NOT NULL, [ThuTu] int NOT NULL, PRIMARY KEY ([VaiTro],[Quyen]));
      CREATE TABLE ${table('ThongTinDangNhap')} ([user_id] nvarchar(128) PRIMARY KEY REFERENCES ${table('TaiKhoan')}([MaTaiKhoan]), [salt] varchar(128) NOT NULL, [hash] varchar(128) NOT NULL)`);
    await query(`CREATE VIEW ${table('vwTaiKhoanDangNhap')} AS SELECT t.*, c.[hash] AS [MatKhauDaBam],
      CASE WHEN c.[user_id] IS NULL THEN 0 ELSE 1 END AS [CoMatKhau] FROM ${table('TaiKhoan')} t LEFT JOIN ${table('ThongTinDangNhap')} c ON c.[user_id]=t.[MaTaiKhoan]`);
  }
  async function read(): Promise<Store | undefined> {
    const meta = (await query(`SELECT * FROM ${table('CauHinhUngDung')} WHERE id=1`)).rows[0];
    if (!meta) return undefined;
    const result: Record<string, unknown> = { version: Number(meta.PhienBan) };
    for (const entity of entities) {
      const rows = (await query(`SELECT ${entity.fields.map(([prop, col]) => `${quote(col)} AS ${quote(prop)}`).join(',')} FROM ${table(entity.table)} ORDER BY [ThuTu],${quote(entity.fields[0][1])}`)).rows;
      result[entity.key] = rows.map(row => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)));
    }
    if (meta.PhienBanPhanQuyen !== null) {
      const access: AccessPolicy = { revision: Number(meta.PhienBanPhanQuyen), roles: {} as AccessPolicy['roles'] };
      const pages = (await query(`SELECT * FROM ${table('TrangVaiTro')} ORDER BY [ThuTu]`)).rows;
      const permissions = (await query(`SELECT * FROM ${table('QuyenVaiTro')} ORDER BY [ThuTu]`)).rows;
      for (const role of ['BGH', 'TDV', 'GV', 'ADMIN'] as const) access.roles[role] = {
        pages: pages.filter(p => p.VaiTro === role).map(p => p.Trang) as AccessPolicy['roles'][typeof role]['pages'],
        permissions: permissions.filter(p => p.VaiTro === role).map(p => p.Quyen) as AccessPolicy['roles'][typeof role]['permissions'],
      };
      result.access = access;
    }
    return result as unknown as Store;
  }
  async function write(value: unknown) {
    const store = value as Store;
    // Reject unmapped data rather than silently discard fields during conversion.
    const rootKeys = new Set(['version', 'access', ...entities.map(e => e.key)]);
    if (!store || store.version !== 1 || Object.keys(store).some(key => !rootKeys.has(key))) throw new Error('Unsupported store format.');
    for (const entity of entities) {
      const rows = store[entity.key];
      if (!Array.isArray(rows)) throw new Error(`Missing array: ${entity.key}`);
      const properties = new Set(entity.fields.map(([prop]) => prop));
      const ids = new Set<string>();
      for (const row of rows as unknown as Record<string, unknown>[]) {
        if (Object.keys(row).some(key => row[key] !== undefined && !properties.has(key))) throw new Error(`Unmapped field: ${entity.key}`);
        if (typeof row.id !== 'string' || ids.has(row.id)) throw new Error(`Invalid or duplicate id: ${entity.key}`);
        ids.add(row.id);
        for (const [prop, , type, required] of entity.fields) {
          const field = row[prop];
          if (field === undefined && !required) continue;
          if (type.startsWith('nvarchar')) {
            const max = Number(type.match(/\((\d+)\)/)?.[1]);
            if (typeof field !== 'string' || field.length > max) throw new Error(`Invalid text: ${entity.key}.${prop}`);
          } else if (type === 'bit' ? typeof field !== 'boolean' : typeof field !== 'number' || !Number.isFinite(field)) {
            throw new Error(`Invalid value: ${entity.key}.${prop}`);
          }
        }
      }
      const payload = JSON.stringify(rows.map((row, index) => ({ ...row, ThuTu: index })));
      const projection = entity.fields.map(([prop, col, type]) => `${quote(col)} ${type} '$.${prop}'`).join(',') + ",[ThuTu] int '$.ThuTu'";
      const key = quote(entity.fields[0][1]);
      const columns = [...entity.fields.map(([, col]) => quote(col)), '[ThuTu]'];
      await query(`UPDATE t SET ${columns.slice(1).map(col => `${col}=s.${col}`).join(',')} FROM ${table(entity.table)} t
        JOIN OPENJSON(@arg1) WITH (${projection}) s ON t.${key}=s.${key};
        INSERT INTO ${table(entity.table)} (${columns.join(',')}) SELECT ${columns.map(col => `s.${col}`).join(',')}
        FROM OPENJSON(@arg1) WITH (${projection}) s WHERE NOT EXISTS (SELECT 1 FROM ${table(entity.table)} t WHERE t.${key}=s.${key})`, [payload]);
    }
    // The web has no delete command; still make writes exact for migrations/tests.
    for (const entity of [...entities].reverse()) await query(`DELETE FROM ${table(entity.table)} WHERE ${quote(entity.fields[0][1])}
      NOT IN (SELECT [id] FROM OPENJSON(@arg1) WITH ([id] nvarchar(128) '$.id'))`, [JSON.stringify(store[entity.key])]);
    await query(`UPDATE ${table('CauHinhUngDung')} SET [PhienBan]=@arg1,[PhienBanPhanQuyen]=@arg2 WHERE id=1;
      IF @@ROWCOUNT=0 INSERT INTO ${table('CauHinhUngDung')} VALUES(1,@arg1,@arg2)`, [store.version, store.access?.revision ?? null]);
    for (const [tableName, key, column] of [['TrangVaiTro', 'pages', 'Trang'], ['QuyenVaiTro', 'permissions', 'Quyen']] as const) {
      const rows = Object.entries(store.access?.roles ?? {}).flatMap(([role, policy]) => policy[key].map((item, index) => ({ role, item, index })));
      await query(`DELETE FROM ${table(tableName)};
        INSERT INTO ${table(tableName)} ([VaiTro],${quote(column)},[ThuTu]) SELECT [role],[item],[index] FROM OPENJSON(@arg1)
        WITH ([role] nvarchar(20),[item] nvarchar(100),[index] int)`, [JSON.stringify(rows)]);
    }
  }
  return { initialize, read, write, table };
}
