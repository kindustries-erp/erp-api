import { toFileAttachmentResponse } from './file-attachment.mapper';
import type { FileAttachment } from '../entities/file-attachment.entity';

describe('toFileAttachmentResponse', () => {
  it('không lộ fileKey, đổi bigint chuỗi sang số, ngày sang ISO', () => {
    const row = {
      id: 'a',
      ownerType: 'INVOICE',
      ownerId: 'o',
      category: 'HOA_DON',
      isOriginal: true,
      fileName: 'a.pdf',
      fileKey: 'files/secret-key',
      fileSize: '2048',
      mimeType: 'application/pdf',
      origin: 'V2',
      createdBy: 'u',
      createdAt: new Date('2026-11-16T00:00:00Z'),
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    } as unknown as FileAttachment;
    const out = toFileAttachmentResponse(row);
    expect(out.fileSize).toBe(2048);
    expect(out.createdAt).toBe('2026-11-16T00:00:00.000Z');
    expect(out.deletedAt).toBeNull();
    expect(JSON.stringify(out)).not.toContain('secret-key');
    expect(out).not.toHaveProperty('fileKey');
  });
});
