export const MAX_EVIDENCE_FILE_SIZE = 3 * 1024 * 1024;
export const MAX_EVIDENCE_REQUEST_SIZE = 10 * 1024 * 1024;
export const MAX_EVIDENCE_FILES_PER_UPLOAD = 5;
export const MAX_EVIDENCE_FILES_PER_INDICATOR = 10;
export const EVIDENCE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.txt,.csv';
export interface EvidenceFile { id: string; name: string; mimeType: string; size: number; uploadedAt: string; uploadedBy: string }
