import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FileCategory,
  FileOrigin,
  FileOwnerType,
  sanitizeFileName,
} from '@/v2/core/storage-core';
import { FileAttachment } from '../entities/file-attachment.entity';

/** Cờ tắt đăng ký tự động (rollback nhanh): đặt `false` thì V1 chạy như cũ, không ghi V2. */
export const LEGACY_REGISTRAR_ENV = 'FILE_ATTACHMENTS_LEGACY_REGISTRAR_ENABLED';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = Object.values(FileCategory) as string[];

export interface LegacyFileInput {
  ownerType: FileOwnerType;
  ownerId: string;
  fileKey: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  /** Giá trị `document_type` của V1; lạ thì về `KHAC`. */
  category?: string | null;
  isOriginal?: boolean;
  /** Vết nguồn, ví dụ `erp_attachments:<id>` hoặc `erp_invoices.pdf_file_key`. */
  legacySource: string;
  userId?: string | null;
}

/** Cột V1 trên `erp_invoices` mà đường ghi tự động cập nhật. */
export type LegacyInvoiceColumn = 'pdf_file_key' | 'xml_file_key' | 'pdf_files';

export interface LegacyInvoiceFileInput {
  invoiceId: string;
  fileKey: string | null | undefined;
  column: LegacyInvoiceColumn;
  fileName?: string | null;
  fileSize?: number | null;
  userId?: string | null;
}

/**
 * Cầu nối các đường ghi file của V1 sang V2: đăng ký (idempotent) hoặc đánh dấu xóa mềm.
 * Không bao giờ ném lỗi ra ngoài để không làm hỏng luồng V1 đang chạy.
 */
@Injectable()
export class LegacyFileRegistrarService {
  private readonly logger = new Logger(LegacyFileRegistrarService.name);

  constructor(
    @InjectRepository(FileAttachment)
    private readonly repo: Repository<FileAttachment>,
  ) {}

  isEnabled(): boolean {
    return (
      (process.env[LEGACY_REGISTRAR_ENV] ?? 'true').toLowerCase() !== 'false'
    );
  }

  /** @returns true nếu đã tạo dòng mới; false nếu bị tắt, đã có sẵn hoặc lỗi (chỉ log). */
  async register(input: LegacyFileInput): Promise<boolean> {
    if (!this.isEnabled() || !input.fileKey || !input.ownerId) return false;
    try {
      const fileName = sanitizeFileName(
        input.fileName || input.fileKey.split('/').pop() || 'file',
      );
      const result = await this.repo
        .createQueryBuilder()
        .insert()
        .into(FileAttachment)
        .values({
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          category: CATEGORIES.includes(input.category ?? '')
            ? (input.category as FileCategory)
            : FileCategory.KHAC,
          isOriginal: input.isOriginal ?? false,
          fileName,
          fileKey: input.fileKey,
          origin: FileOrigin.LEGACY,
          legacySource: input.legacySource.slice(0, 96),
          fileSize: String(Math.max(0, Math.trunc(input.fileSize ?? 0))),
          mimeType: input.mimeType ?? null,
          createdBy:
            input.userId && UUID_RE.test(input.userId) ? input.userId : null,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        })
        // Unique một phần (owner, file_key) khi chưa xóa: đã có thì bỏ qua
        .orIgnore()
        .execute();
      return (result.identifiers?.filter(Boolean).length ?? 0) > 0;
    } catch (error) {
      this.logger.warn(
        `Không đăng ký được file legacy ${input.fileKey}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /** Đường ghi tự động của hóa đơn (import, portal, PDF gốc): đăng ký file theo cột V1 đã cập nhật. */
  registerInvoiceFile(input: LegacyInvoiceFileInput): Promise<boolean> {
    if (!input.fileKey) return Promise.resolve(false);
    return this.register({
      ownerType: FileOwnerType.INVOICE,
      ownerId: input.invoiceId,
      fileKey: input.fileKey,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType:
        input.column === 'xml_file_key' ? 'application/xml' : 'application/pdf',
      category: FileCategory.HOA_DON,
      isOriginal: input.column === 'pdf_file_key',
      legacySource: `erp_invoices.${input.column}`,
      userId: input.userId,
    });
  }

  /** V1 gỡ/xóa file: xóa mềm dòng V2 tương ứng. Trả số dòng đã đổi (0 khi tắt hoặc lỗi). */
  async unregister(
    ownerType: FileOwnerType,
    ownerId: string,
    fileKey: string,
    userId?: string | null,
  ): Promise<number> {
    if (!this.isEnabled() || !fileKey || !ownerId) return 0;
    try {
      const result = await this.repo.update(
        { ownerType, ownerId, fileKey, isDeleted: false },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId && UUID_RE.test(userId) ? userId : null,
        },
      );
      return result.affected ?? 0;
    } catch (error) {
      this.logger.warn(
        `Không đánh dấu xóa file legacy ${fileKey}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /** V1 xóa hẳn object theo khóa: xóa mềm mọi dòng V2 còn hoạt động trỏ khóa đó (mọi owner). */
  async unregisterByKey(
    fileKey: string,
    userId?: string | null,
  ): Promise<number> {
    if (!this.isEnabled() || !fileKey) return 0;
    try {
      const result = await this.repo.update(
        { fileKey, isDeleted: false },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId && UUID_RE.test(userId) ? userId : null,
        },
      );
      return result.affected ?? 0;
    } catch (error) {
      this.logger.warn(
        `Không đánh dấu xóa theo khóa ${fileKey}: ${(error as Error).message}`,
      );
      return 0;
    }
  }
}
