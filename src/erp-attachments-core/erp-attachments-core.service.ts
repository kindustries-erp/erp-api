import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Like,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { ErpAttachment } from './entities/erp_attachment.entity';
import { R2Service } from '../r2/r2.service';
import * as crypto from 'crypto';

@Injectable()
export class ErpAttachmentsCoreService {
  constructor(
    @InjectRepository(ErpAttachment)
    private readonly repo: Repository<ErpAttachment>,
    private readonly r2Service: R2Service,
  ) {}

  async findAll(query: any) {
    const {
      page = 1,
      pageSize = 20,
      search,
      document_type,
      dateFrom,
      dateTo,
      filtersStr,
    } = query;
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const baseSql = `
      SELECT
        a.id::text as id,
        a.file_name,
        a.file_key,
        a.file_size,
        a.mime_type,
        a.document_type,
        a.module,
        a.created_at,
        i.invoice_no,
        i.id as invoice_id,
        i.direction as invoice_direction
      FROM erp_attachments a
      LEFT JOIN erp_invoice_attachments eia ON eia.attachment_id = a.id
      LEFT JOIN erp_invoices i ON i.id = eia.invoice_id AND i.is_deleted = false

      UNION ALL

      SELECT
        inv.id::text as id,
        SPLIT_PART(inv.pdf_file_key, '/', -1) as file_name,
        inv.pdf_file_key as file_key,
        0 as file_size,
        'application/pdf' as mime_type,
        'HOA_DON' as document_type,
        'invoices' as module,
        inv.created_at,
        inv.invoice_no,
        inv.id as invoice_id,
        inv.direction as invoice_direction
      FROM erp_invoices inv
      WHERE inv.pdf_file_key IS NOT NULL AND inv.is_deleted = false

      UNION ALL

      SELECT
        inv.id::text || '_' || (f->>'key') as id,
        f->>'filename' as file_name,
        f->>'key' as file_key,
        0 as file_size,
        'application/pdf' as mime_type,
        'HOA_DON' as document_type,
        'invoices' as module,
        (f->>'uploadedAt')::timestamp as created_at,
        inv.invoice_no,
        inv.id as invoice_id,
        inv.direction as invoice_direction
      FROM erp_invoices inv,
        jsonb_array_elements(inv.pdf_files) f
      WHERE inv.pdf_files IS NOT NULL AND inv.pdf_files::text != '[]' AND inv.pdf_files::text != 'null' AND inv.is_deleted = false

      UNION ALL

      SELECT
        inv.id::text || '_xml' as id,
        SPLIT_PART(inv.xml_file_key, '/', -1) as file_name,
        inv.xml_file_key as file_key,
        0 as file_size,
        'application/xml' as mime_type,
        'HOA_DON' as document_type,
        'invoices' as module,
        inv.created_at,
        inv.invoice_no,
        inv.id as invoice_id,
        inv.direction as invoice_direction
      FROM erp_invoices inv
      WHERE inv.xml_file_key IS NOT NULL AND inv.is_deleted = false
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`file_name ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }
    if (document_type) {
      whereClauses.push(`document_type = $${paramIndex++}`);
      params.push(document_type);
    }
    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        whereClauses.push(
          `created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`,
        );
        params.push(new Date(dateFrom), to);
      } else if (dateFrom) {
        whereClauses.push(`created_at >= $${paramIndex++}`);
        params.push(new Date(dateFrom));
      } else if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        whereClauses.push(`created_at <= $${paramIndex++}`);
        params.push(to);
      }
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          let filterField = '';
          if (col === 'fileName') filterField = 'file_name';
          else if (col === 'documentType') filterField = 'document_type';
          else if (col === 'module') filterField = 'module';
          else if (col === 'fileSize') filterField = 'file_size';
          else if (col === 'fileExt')
            filterField = "UPPER(SUBSTRING(file_name FROM '\\.([^\\.]+)$'))";
          else if (col === 'relatedDocs') filterField = 'invoice_no';

          if (filterField) {
            const placeholders = vals.map(() => `$${paramIndex++}`).join(',');
            whereClauses.push(
              `CAST(${filterField} AS TEXT) IN (${placeholders})`,
            );
            params.push(...vals);
          }
        }
      } catch {}
    }

    const whereStr =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM (${baseSql}) as combined ${whereStr}`;
    const dataQuery = `SELECT * FROM (${baseSql}) as combined ${whereStr} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

    const countResult = await this.repo.manager.query(countQuery, params);
    const total = parseInt(countResult[0].count, 10);

    const dataResult = await this.repo.manager.query(dataQuery, [
      ...params,
      limit,
      offset,
    ]);

    const items = dataResult.map((row: any) => ({
      id: row.id,
      fileName: row.file_name,
      fileKey: row.file_key,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      documentType: row.document_type,
      module: row.module,
      createdAt: row.created_at,
      invoiceLinks: row.invoice_id
        ? [
            {
              invoice: {
                id: row.invoice_id,
                invoiceNo: row.invoice_no,
                direction: row.invoice_direction,
              },
            },
          ]
        : [],
      _isLegacy: row.id.includes('_'),
    }));

    return {
      items,
      total,
      page: Number(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const attachment = await this.repo.findOne({ where: { id } });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const qb = this.repo.createQueryBuilder('att');
    let selectField = '';

    if (column === 'fileName') selectField = 'att.file_name';
    else if (column === 'documentType') selectField = 'att.document_type';
    else if (column === 'module') selectField = 'att.module';
    else if (column === 'fileSize') selectField = 'att.file_size';
    else if (column === 'fileExt') {
      selectField = "UPPER(SUBSTRING(att.file_name FROM '\\.([^\\.]+)$'))";
    } else if (column === 'relatedDocs') {
      selectField = 'invoice.invoice_no';
      qb.leftJoin('att.invoiceLinks', 'invoiceLinks');
      qb.leftJoin('invoiceLinks.invoice', 'invoice');
    } else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    qb.select(`DISTINCT ${selectField}`, 'value');
    qb.andWhere(`${selectField} IS NOT NULL`);
    qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;
          let filterField = '';
          if (col === 'fileName') filterField = 'att.file_name';
          else if (col === 'documentType') filterField = 'att.document_type';
          else if (col === 'module') filterField = 'att.module';
          else if (col === 'fileSize') filterField = 'att.file_size';
          else if (col === 'fileExt')
            filterField =
              "UPPER(SUBSTRING(att.file_name FROM '\\.([^\\.]+)$'))";
          else if (col === 'relatedDocs') filterField = 'invoice.invoice_no';

          if (filterField) {
            qb.andWhere(`CAST(${filterField} AS TEXT) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          }
        }
      } catch {}
    }

    if (search) {
      qb.andWhere(`CAST(${selectField} AS TEXT) ILIKE :search`, {
        search: `%${search}%`,
      });
    }

    qb.orderBy('value', 'ASC');

    const rawData = await qb.getRawMany();
    const allItems = rawData.map((row) => ({
      label: row.value?.toString() || '—',
      value: row.value?.toString() || '—',
    }));

    const total = allItems.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = allItems.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async uploadFile(
    file: { filename: string; buffer: Buffer; mimetype: string },
    documentType: string,
    userId: string,
    module?: string,
  ) {
    const ext = file.filename.split('.').pop();
    const uniqueId = crypto.randomUUID();
    const fileKey = `${documentType}/${uniqueId}_${file.filename}`;

    await this.r2Service.uploadBuffer(fileKey, file.buffer, file.mimetype);

    const attachment = this.repo.create({
      fileName: file.filename,
      fileKey,
      fileSize: file.buffer.length,
      mimeType: file.mimetype,
      documentType,
      module,
      createdBy: userId,
    });

    return this.repo.save(attachment);
  }

  async remove(id: string) {
    const attachment = await this.findOne(id);
    await this.r2Service.deleteObject(attachment.fileKey);
    await this.repo.remove(attachment);
    return { success: true };
  }

  async getDownloadUrl(id: string, inline = false) {
    const attachment = await this.findOne(id);
    const url = await this.r2Service.getPresignedDownloadUrl(
      attachment.fileKey,
      3600,
      attachment.fileName,
      inline,
    );
    return { url };
  }

  async getFileContent(id: string) {
    const attachment = await this.findOne(id);
    return this.r2Service.downloadBuffer(attachment.fileKey);
  }
}
