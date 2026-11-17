import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { FileKeyReferenceSource } from '@/v2/core/file-attachments-core';

async function countRows(
  ds: DataSource,
  sql: string,
  params: unknown[],
): Promise<number> {
  const rows: Array<{ n: string | number }> = await ds.query(sql, params);
  return Number(rows[0]?.n ?? 0);
}

/** Mọi dòng `file_attachments` (kể cả đã xóa mềm) trừ dòng đang xét. */
@Injectable()
export class FileAttachmentsKeySource implements FileKeyReferenceSource {
  readonly name = 'file_attachments';
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  count(fileKey: string, excludeId?: string): Promise<number> {
    return countRows(
      this.ds,
      `SELECT COUNT(*) AS n FROM file_attachments WHERE file_key = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`,
      [fileKey, excludeId ?? null],
    );
  }
}

/** Bảng V1 `erp_attachments` (còn chạy song song cho tới khi gỡ V1). */
@Injectable()
export class LegacyAttachmentsKeySource implements FileKeyReferenceSource {
  readonly name = 'erp_attachments';
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  count(fileKey: string): Promise<number> {
    return countRows(
      this.ds,
      `SELECT COUNT(*) AS n FROM erp_attachments WHERE file_key = $1`,
      [fileKey],
    );
  }
}

/** Các cột khóa trực tiếp trên hóa đơn: `pdf_file_key`, `xml_file_key`, `pdf_files[].key`. */
@Injectable()
export class InvoiceKeysSource implements FileKeyReferenceSource {
  readonly name = 'erp_invoices';
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  count(fileKey: string): Promise<number> {
    return countRows(
      this.ds,
      `SELECT COUNT(*) AS n FROM erp_invoices
       WHERE pdf_file_key = $1 OR xml_file_key = $1
          OR (jsonb_typeof(pdf_files) = 'array'
              AND pdf_files @> jsonb_build_array(jsonb_build_object('key', $1::text)))`,
      [fileKey],
    );
  }
}
