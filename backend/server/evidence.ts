import Busboy from 'busboy';
import { fileTypeFromBuffer } from 'file-type';
import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { createDatabase } from './database-sqlserver.ts';
import { MAX_EVIDENCE_FILE_SIZE, MAX_EVIDENCE_REQUEST_SIZE, MAX_EVIDENCE_FILES_PER_UPLOAD, MAX_EVIDENCE_FILES_PER_INDICATOR, type EvidenceFile } from '../src/shared/evidence.ts';

type Database = ReturnType<typeof createDatabase>;
export type ParsedEvidence = { actual: number; evidence: string; files: { name: string; mimeType: string; content: Buffer }[] };
function reject(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
export function evidenceStorage(db: Database, kind: 'indicator' | 'task' = 'indicator') {
  const tableName = kind === 'task' ? 'task_attachments' : 'attachments';
  const table = `[${db.schema}].[${tableName}]`;
  const columns = 'id, file_name AS name, mime_type AS mimeType, byte_size AS size, uploaded_at AS uploadedAt, uploaded_by AS uploadedBy';
  return {
    async initialize() {
      await db.transaction(async () => {
        await db.query(`IF OBJECT_ID(N'${db.schema}.${tableName}',N'U') IS NULL BEGIN
          CREATE TABLE ${table} (id varchar(36) PRIMARY KEY, indicator_id nvarchar(128) NOT NULL,
            file_name nvarchar(200) NOT NULL, mime_type varchar(100) NOT NULL, byte_size int NOT NULL CHECK(byte_size BETWEEN 1 AND ${MAX_EVIDENCE_FILE_SIZE}),
            uploaded_by nvarchar(128) NOT NULL, uploaded_at varchar(30) NOT NULL, sha256 char(64) NOT NULL, content varbinary(max) NOT NULL);
          CREATE INDEX IX_attachments_indicator ON ${table}(indicator_id);
        END`);
        const storage = await db.storageInfo();
        if (storage.mode === 'relational') await db.query(`IF NOT EXISTS (
          SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'${db.schema}.${tableName}'))
          ALTER TABLE ${table} ADD FOREIGN KEY (indicator_id) REFERENCES [${storage.schema}].[${kind === 'task' ? 'NhiemVu' : 'KPI'}]([${kind === 'task' ? 'MaNhiemVu' : 'MaKPI'}])`);
      });
    },
    async list(indicatorId: string): Promise<EvidenceFile[]> {
      return (await db.query(`SELECT ${columns} FROM ${table} WHERE indicator_id=@arg1 ORDER BY uploaded_at,id`, [indicatorId])).rows as EvidenceFile[];
    },
    async has(indicatorId: string) { return (await db.query(`SELECT TOP(1) id FROM ${table} WHERE indicator_id=@arg1`, [indicatorId])).rowCount > 0; },
    async get(id: string) { return (await db.query(`SELECT ${columns},indicator_id AS indicatorId,content FROM ${table} WHERE id=@arg1`, [id])).rows[0] as EvidenceFile & { indicatorId: string; content: Buffer } | undefined; },
    async add(indicatorId: string, uploadedBy: string, files: ParsedEvidence['files']) {
      const existing = await this.list(indicatorId);
      if (existing.length + files.length > MAX_EVIDENCE_FILES_PER_INDICATOR) reject('Mỗi mục được đính kèm tối đa 10 tệp.');
      for (const file of files) await db.query(`INSERT INTO ${table}
        (id,indicator_id,file_name,mime_type,byte_size,uploaded_by,uploaded_at,sha256,content)
        VALUES(@arg1,@arg2,@arg3,@arg4,@arg5,@arg6,@arg7,@arg8,@arg9)`,
      [randomUUID(), indicatorId, file.name, file.mimeType, file.content.length, uploadedBy, new Date().toISOString(), createHash('sha256').update(file.content).digest('hex'), file.content]);
    },
  };
}
export async function parseEvidence(req: IncomingMessage): Promise<ParsedEvidence> {
  if (!req.headers['content-type']?.startsWith('multipart/form-data;')) reject('Hãy gửi kết quả và tệp theo biểu mẫu tải lên.', 415);
  const raw = await new Promise<Buffer>((resolve, fail) => {
    const chunks: Buffer[] = []; let size = 0; let exceeded = false;
    req.on('data', (chunk: Buffer) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_EVIDENCE_REQUEST_SIZE) { exceeded = true; chunks.length = 0; fail(Object.assign(new Error('Tổng dữ liệu mỗi lần gửi tối đa 10 MB.'), { status: 413 })); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!exceeded) resolve(Buffer.concat(chunks)); });
    req.on('error', fail);
    req.on('aborted', () => fail(Object.assign(new Error('Tải tệp bị gián đoạn.'), { status: 400 })));
  });
  const fields: Record<string, string> = {};
  const files: { name: string; content: Buffer }[] = [];
  let invalid: string | undefined;
  await new Promise<void>((resolve, fail) => {
    let parser: ReturnType<typeof Busboy>;
    try { parser = Busboy({ headers: req.headers, defParamCharset: 'utf8', limits: { files: MAX_EVIDENCE_FILES_PER_UPLOAD, fileSize: MAX_EVIDENCE_FILE_SIZE, fields: 2, fieldSize: 8192, parts: 8 } }); }
    catch { fail(Object.assign(new Error('Biểu mẫu tải tệp không hợp lệ.'), { status: 400 })); return; }
    parser.on('field', (name, value, info) => {
      if (!['actual', 'evidence'].includes(name) || name in fields || info.valueTruncated || info.nameTruncated) invalid = 'Thông tin kết quả không hợp lệ.';
      fields[name] = value;
    });
    parser.on('file', (field, stream, info) => {
      const chunks: Buffer[] = [];
      if (field !== 'files') invalid = 'Trường tệp không hợp lệ.';
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => { invalid = 'Mỗi tệp tối đa 3 MB.'; });
      stream.on('error', fail);
      stream.on('end', () => {
        const name = basename((info.filename ?? '').replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '').trim();
        if (!name || name.length > 200 || stream.truncated) invalid ??= 'Tên tệp không hợp lệ hoặc tệp vượt 3 MB.';
        files.push({ name, content: Buffer.concat(chunks) });
      });
    });
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit'] as const) parser.on(event, () => { invalid = 'Mỗi lần gửi tối đa 5 tệp và các thông tin kết quả.'; });
    parser.on('error', () => fail(Object.assign(new Error('Không đọc được biểu mẫu tải tệp.'), { status: 400 })));
    parser.on('close', resolve);
    parser.end(raw);
  });
  if (invalid) reject(invalid, invalid.includes('3 MB') ? 413 : 400);
  if (!fields.actual?.trim() || !Number.isFinite(Number(fields.actual)) || Number(fields.actual) < 0) reject('Nhập số lượng thực tế đã hoàn thành, từ 0 trở lên.');
  if ((fields.evidence ?? '').length > 2000) reject('Mô tả minh chứng tối đa 2.000 ký tự.');
  const validated: ParsedEvidence['files'] = [];
  for (const file of files) {
    if (!file.content.length) reject('Không gửi tệp trống.');
    const extension = extname(file.name).slice(1).toLowerCase();
    let mimeType: string;
    if (['txt', 'csv'].includes(extension)) {
      try { new TextDecoder('utf-8', { fatal: true }).decode(file.content); } catch { reject('Tệp văn bản cần dùng mã UTF-8.'); }
      if (file.content.includes(0)) reject('Nội dung tệp văn bản không hợp lệ.');
      mimeType = extension === 'csv' ? 'text/csv' : 'text/plain';
    } else {
      let detected;
      try { detected = await fileTypeFromBuffer(file.content); } catch { reject('Không nhận dạng được nội dung tệp.'); }
      const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
      if (!detected || !['jpg', 'png', 'webp', 'pdf', 'docx', 'xlsx'].includes(detected.ext) || detected.ext !== normalizedExtension) reject('Chỉ nhận ảnh JPG/PNG/WebP, PDF, DOCX, XLSX, TXT hoặc CSV có nội dung đúng định dạng.');
      mimeType = detected.mime;
    }
    validated.push({ ...file, mimeType });
  }
  return { actual: Number(fields.actual), evidence: fields.evidence ?? '', files: validated };
}
