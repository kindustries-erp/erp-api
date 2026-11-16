import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { R2Service } from '@/r2/r2.service';
import {
  FILE_KEY_REFERENCE_SOURCES,
  FileOwnerRegistry,
  STORAGE_POLICY_PROVIDER,
} from '@/v2/core/storage-core';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import { FileAttachmentSettings } from './entities/file-attachment-settings.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { FileAttachmentsModule } from './file-attachments.module';
import { FileAttachmentsService } from './file-attachments.service';
import { FileAttachmentPurgeJob } from './jobs/file-attachment-purge.job';
import { CodeStoragePolicyProvider } from './services/code-storage-policy.provider';
import { FileKeyReferenceChecker } from './services/file-key-reference.checker';

/** Dựng lại danh sách provider của module với các phụ thuộc ngoài được thay bằng mock. */
async function build() {
  const providers: unknown[] = Reflect.getMetadata(
    'providers',
    FileAttachmentsModule,
  );
  return Test.createTestingModule({
    providers: [
      ...(providers as never[]),
      { provide: getRepositoryToken(FileAttachment), useValue: {} },
      { provide: getRepositoryToken(FileAttachmentSettings), useValue: {} },
      { provide: getDataSourceToken(), useValue: { query: jest.fn() } },
      { provide: R2Service, useValue: {} },
      { provide: AuditWriterService, useValue: { recordAction: jest.fn() } },
    ],
  }).compile();
}

describe('FileAttachmentsModule wiring', () => {
  it('resolve được facade, job và policy mặc định', async () => {
    const ref = await build();
    expect(ref.get(FileAttachmentsService)).toBeDefined();
    expect(ref.get(FileAttachmentPurgeJob).jobName).toBe(
      'file-attachments-purge',
    );
    expect(ref.get(STORAGE_POLICY_PROVIDER)).toBeInstanceOf(
      CodeStoragePolicyProvider,
    );
    expect(ref.get(FileOwnerRegistry)).toBeDefined();
  });

  it('đăng ký đủ 3 nguồn tham chiếu khóa cho checker', async () => {
    const ref = await build();
    const names = (
      ref.get(FILE_KEY_REFERENCE_SOURCES) as Array<{ name: string }>
    )
      .map((s) => s.name)
      .sort();
    expect(names).toEqual([
      'erp_attachments',
      'erp_invoices',
      'file_attachments',
    ]);
    expect(ref.get(FileKeyReferenceChecker)).toBeDefined();
  });

  it('module khai báo controller quản lý và export facade + registry', () => {
    expect(
      Reflect.getMetadata('controllers', FileAttachmentsModule),
    ).toHaveLength(1);
    const exported: unknown[] = Reflect.getMetadata(
      'exports',
      FileAttachmentsModule,
    );
    expect(exported).toEqual(
      expect.arrayContaining([FileAttachmentsService, FileOwnerRegistry]),
    );
  });
});
