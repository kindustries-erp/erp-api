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
    const skip = (page - 1) * pageSize;

    const qb = this.repo.createQueryBuilder('att');
    qb.leftJoinAndSelect('att.invoiceLinks', 'invoiceLinks');
    qb.leftJoinAndSelect('invoiceLinks.invoice', 'invoice');

    if (search) {
      qb.andWhere('att.file_name ILIKE :search', { search: `%${search}%` });
    }
    if (document_type) {
      qb.andWhere('att.document_type = :docType', { docType: document_type });
    }
    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        qb.andWhere('att.created_at BETWEEN :dateFrom AND :dateTo', {
          dateFrom: new Date(dateFrom),
          dateTo: to,
        });
      } else if (dateFrom) {
        qb.andWhere('att.created_at >= :dateFrom', {
          dateFrom: new Date(dateFrom),
        });
      } else if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        qb.andWhere('att.created_at <= :dateTo', { dateTo: to });
      }
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
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

    qb.orderBy('att.createdAt', 'DESC');
    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    return {
      items: data,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize),
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
