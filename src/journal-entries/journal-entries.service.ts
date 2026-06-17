import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  In,
  Like,
} from 'typeorm';
import { ErpJournalEntry } from './entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from './entities/erp_journal_entry_line.entity';
import { ErpAccountingPeriod } from './entities/erp_accounting_period.entity';
import { ErpChartOfAccount } from './entities/erp_chart_of_account.entity';
import { ErpJournalEntryAttachment } from './entities/erp_journal_entry_attachment.entity';
import { R2Service } from '../erp-invoices-core/r2/r2.service';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import * as crypto from 'crypto';

@Injectable()
export class JournalEntriesService {
  private readonly logger = new Logger(JournalEntriesService.name);

  constructor(
    @InjectRepository(ErpJournalEntry)
    private readonly journalEntryRepo: Repository<ErpJournalEntry>,
    @InjectRepository(ErpJournalEntryLine)
    private readonly journalLineRepo: Repository<ErpJournalEntryLine>,
    @InjectRepository(ErpAccountingPeriod)
    private readonly periodRepo: Repository<ErpAccountingPeriod>,
    @InjectRepository(ErpChartOfAccount)
    private readonly accountRepo: Repository<ErpChartOfAccount>,
    @InjectRepository(ErpJournalEntryAttachment)
    private readonly attachmentRepo: Repository<ErpJournalEntryAttachment>,
    private readonly r2Service: R2Service,
    private readonly dataSource: DataSource,
  ) {}

  private validateBalanced(lines: CreateJournalEntryDto['lines']) {
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    const d = Math.round(totalDebit * 100);
    const c = Math.round(totalCredit * 100);
    if (d !== c) {
      throw new BadRequestException(
        `Bút toán mất cân: tổng nợ ${totalDebit} ≠ tổng có ${totalCredit}`,
      );
    }
    return { totalDebit, totalCredit };
  }

  async findAll(query: JournalEntryQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const qb = this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.period', 'period')
      .leftJoinAndSelect('je.lines', 'line')
      .leftJoinAndSelect('line.account', 'account')
      .leftJoinAndSelect('je.attachments', 'attachment')
      .where('je.status IN (:...statuses)', {
        statuses: ['POSTED', 'REVERSED'],
      });

    if (query.status) {
      qb.andWhere('je.status = :status', {
        status: query.status.toUpperCase(),
      });
    }
    if (query.period_id) {
      qb.andWhere('je.period_id = :periodId', { periodId: query.period_id });
    }
    if (query.date_from) {
      qb.andWhere('je.date >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      qb.andWhere('je.date <= :dateTo', { dateTo: query.date_to });
    }
    if (query.search) {
      qb.andWhere('je.voucher_no ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.account_id) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM erp_journal_entry_lines l WHERE l.journal_entry_id = je.id AND l.account_id = :accountId)',
        { accountId: query.account_id },
      );
    }

    const sortField =
      query.sort && query.sort.startsWith('-')
        ? query.sort.substring(1)
        : query.sort || 'date';
    const sortOrder = query.sort && query.sort.startsWith('-') ? 'DESC' : 'ASC';

    qb.orderBy(`je.${sortField}`, sortOrder);
    qb.skip(offset).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const entry = await this.journalEntryRepo.findOne({
      where: { id },
      relations: ['period', 'lines', 'lines.account', 'attachments'],
      order: {
        lines: {
          sort: 'ASC',
        },
      },
    });

    if (!entry) throw new NotFoundException(`Không tìm thấy bút toán: ${id}`);
    return { message: 'Lấy thông tin bút toán thành công', data: entry };
  }

  async create(dto: CreateJournalEntryDto, userId: string) {
    const { totalDebit, totalCredit } = this.validateBalanced(dto.lines);

    let periodId = dto.period_id || null;
    if (!periodId && dto.date) {
      const p = await this.periodRepo.findOne({
        where: {
          status: 'OPEN',
          startDate: LessThanOrEqual(dto.date),
          endDate: MoreThanOrEqual(dto.date),
        },
      });
      if (p) periodId = p.id;
    }

    let voucherNo = dto.voucher_no;
    if (!voucherNo) {
      const dateStr = dto.date.replace(/-/g, '').slice(0, 8);
      const count = await this.journalEntryRepo.count();
      voucherNo = `JNL-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entry = this.journalEntryRepo.create({
        voucherNo,
        date: dto.date,
        periodId,
        description: dto.description || null,
        status: 'POSTED',
        referenceType: dto.reference_type || null,
        referenceId: dto.reference_id || null,
        totalDebit,
        totalCredit,
        createdBy: userId,
      });

      const savedEntry = await queryRunner.manager.save(entry);

      const lines = dto.lines.map((l, idx) => {
        return this.journalLineRepo.create({
          journalEntryId: savedEntry.id,
          accountId: l.account_id,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description || null,
          sort: l.sort ?? idx,
        });
      });

      await queryRunner.manager.save(lines);
      await queryRunner.commitTransaction();

      const fullEntry = await this.journalEntryRepo.findOne({
        where: { id: savedEntry.id },
        relations: ['lines', 'lines.account'],
      });

      return {
        message: 'Tạo bút toán thành công',
        data: fullEntry,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Lỗi tạo bút toán:', err);
      throw new BadRequestException('Không thể tạo bút toán');
    } finally {
      await queryRunner.release();
    }
  }

  async post(id: string) {
    const entry = await this.journalEntryRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Không tìm thấy bút toán: ${id}`);
    if (entry.status === 'POSTED') {
      return { message: 'Bút toán đã ở trạng thái posted', data: entry };
    }
    throw new BadRequestException(
      `Journal Entry không còn workflow Draft/Post thủ công.`,
    );
  }

  async update(id: string, dto: UpdateJournalEntryDto) {
    const entry = await this.journalEntryRepo.findOne({
      where: { id },
      relations: ['lines'],
    });

    if (!entry) throw new NotFoundException('Không tìm thấy bút toán');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.description !== undefined) {
        entry.description = dto.description;
        await queryRunner.manager.save(entry);
      }

      if (dto.lines && dto.lines.length > 0) {
        for (const lineDto of dto.lines) {
          if (!lineDto.id) continue;
          const line = entry.lines.find((l) => l.id === lineDto.id);
          if (line) {
            if (lineDto.account_id) line.accountId = lineDto.account_id;
            if (lineDto.description !== undefined)
              line.description = lineDto.description;
            await queryRunner.manager.save(line);
          }
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Lỗi cập nhật bút toán:', err);
      throw new BadRequestException('Lỗi cập nhật bút toán');
    } finally {
      await queryRunner.release();
    }
  }

  async getSourceDocument(id: string) {
    const entry = await this.journalEntryRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Không tìm thấy bút toán');
    if (!entry.referenceType || !entry.referenceId) return { data: null };

    // Whitelist allowed table names to prevent SQL injection
    const ALLOWED_REFERENCE_TYPES = new Set([
      'erp_goods_receipts',
      'erp_goods_issues',
      'erp_purchase_orders',
      'erp_sales_orders',
      'erp_production_orders',
      'erp_cashflow_vouchers',
      'payment_vouchers',
    ]);

    if (!ALLOWED_REFERENCE_TYPES.has(entry.referenceType)) {
      this.logger.warn(
        `Blocked getSourceDocument for unknown referenceType: ${entry.referenceType}`,
      );
      return { data: null };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const [doc] = await queryRunner.query(
        `SELECT * FROM ${entry.referenceType} WHERE id = $1 LIMIT 1`,
        [entry.referenceId],
      );
      return { data: doc || null };
    } catch (err) {
      this.logger.error('Lỗi lấy source document:', err);
      return { data: null };
    } finally {
      await queryRunner.release();
    }
  }

  async findPeriodOptions() {
    const periods = await this.periodRepo.find({
      order: { startDate: 'DESC' },
      take: 50,
    });
    return {
      items: periods.map((p) => ({ id: p.id, period_code: p.name })),
    };
  }

  async findAccountOptions(search?: string) {
    const where = search ? { accountCode: Like(`%${search}%`) } : {}; // Simplified for now
    const accounts = await this.accountRepo.find({
      where,
      order: { accountCode: 'ASC' },
      take: 200,
    });
    return {
      items: accounts.map((a) => ({
        id: a.id,
        account_code: a.accountCode,
        account_name: a.accountName,
      })),
    };
  }

  async addAttachment(id: string, file: Express.Multer.File, userId: string) {
    const entry = await this.journalEntryRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Không tìm thấy bút toán');

    const ext = file.originalname.split('.').pop() || '';
    const r2Key = `journal-entries/${id}/${crypto.randomUUID()}.${ext}`;

    try {
      await this.r2Service.uploadBuffer(r2Key, file.buffer, file.mimetype);
    } catch (err) {
      this.logger.error('R2 upload error:', err);
      throw new BadRequestException('Không thể tải file lên R2');
    }

    const attachment = this.attachmentRepo.create({
      journalEntryId: id,
      fileName: file.originalname,
      r2FileKey: r2Key,
      contentType: file.mimetype,
      fileSize: file.size,
      uploadedBy: userId,
    });

    await this.attachmentRepo.save(attachment);
    return attachment;
  }

  async getAttachmentDownloadUrl(attachmentId: string) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment)
      throw new NotFoundException('Không tìm thấy file đính kèm');

    const url = await this.r2Service.getPresignedDownloadUrl(
      attachment.r2FileKey,
      3600,
    );
    return { url };
  }

  async removeAttachment(attachmentId: string) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment)
      throw new NotFoundException('Không tìm thấy file đính kèm');

    try {
      await this.r2Service.deleteObject(attachment.r2FileKey);
    } catch (err) {
      this.logger.error('R2 delete error:', err);
    }

    await this.attachmentRepo.remove(attachment);
    return { message: 'Đã xóa file đính kèm' };
  }
}
