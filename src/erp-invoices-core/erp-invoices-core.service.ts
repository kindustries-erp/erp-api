import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';

export interface ErpInvoiceQuery {
  direction?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ErpInvoicesCoreService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
  ) {}

  async findAll(query: ErpInvoiceQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 40;

    const where: any = {};

    if (query.direction) {
      where.direction = query.direction;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.date_from && query.date_to) {
      where.invoiceDate = Between(query.date_from, query.date_to);
    } else if (query.date_from) {
      where.invoiceDate = MoreThanOrEqual(query.date_from);
    } else if (query.date_to) {
      where.invoiceDate = LessThanOrEqual(query.date_to);
    }

    // Search theo invoice_no, buyer_name, seller_name
    if (query.search) {
      const searchResults = await this.repository
        .createQueryBuilder('inv')
        .where(
          `inv.invoice_no ILIKE :q OR inv.buyer_name ILIKE :q OR inv.seller_name ILIKE :q OR inv.buyer_tax_code ILIKE :q OR inv.seller_tax_code ILIKE :q`,
          { q: `%${query.search}%` },
        )
        .andWhere(query.direction ? 'inv.direction = :dir' : '1=1', {
          dir: query.direction,
        })
        .andWhere(query.status ? 'inv.status = :status' : '1=1', {
          status: query.status,
        })
        .andWhere(query.date_from ? 'inv.invoice_date >= :dateFrom' : '1=1', {
          dateFrom: query.date_from,
        })
        .andWhere(query.date_to ? 'inv.invoice_date <= :dateTo' : '1=1', {
          dateTo: query.date_to,
        })
        .orderBy('inv.invoice_date', 'DESC')
        .addOrderBy('inv.created_at', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return {
        items: searchResults[0].map((i) => this.toDto(i)),
        total: searchResults[1],
        page,
        pageSize,
        totalPages: Math.ceil(searchResults[1] / pageSize),
      };
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((i) => this.toDto(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({ where: { id } });
    if (!data) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    return { message: 'Lấy thông tin thành công', data: this.toDto(data) };
  }

  async create(dto: CreateErpInvoiceDto) {
    const invoice = this.repository.create({
      ...dto,
      preVatAmount: String(dto.preVatAmount ?? 0),
      vatRate: dto.vatRate != null ? String(dto.vatRate) : null,
      vatAmount: String(dto.vatAmount ?? 0),
      discountAmount: String(dto.discountAmount ?? 0),
      totalAmount: String(dto.totalAmount ?? 0),
    } as any);
    const saved = (await this.repository.save(
      invoice,
    )) as unknown as ErpInvoice;
    return { message: 'Tạo thành công', data: this.toDto(saved) };
  }

  async update(id: string, dto: UpdateErpInvoiceDto) {
    const existing = await this.repository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);

    const updatePayload: any = { ...dto };
    if (dto.preVatAmount != null)
      updatePayload.preVatAmount = String(dto.preVatAmount);
    if (dto.vatRate != null) updatePayload.vatRate = String(dto.vatRate);
    if (dto.vatAmount != null) updatePayload.vatAmount = String(dto.vatAmount);
    if (dto.discountAmount != null)
      updatePayload.discountAmount = String(dto.discountAmount);
    if (dto.totalAmount != null)
      updatePayload.totalAmount = String(dto.totalAmount);

    await this.repository.update(id, updatePayload);
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    await this.repository.delete(id);
    return { message: 'Xóa thành công' };
  }

  private toDto(invoice: ErpInvoice) {
    return {
      ...invoice,
      preVatAmount:
        invoice.preVatAmount != null ? String(invoice.preVatAmount) : '0',
      vatRate: invoice.vatRate != null ? String(invoice.vatRate) : null,
      vatAmount: invoice.vatAmount != null ? String(invoice.vatAmount) : '0',
      discountAmount:
        invoice.discountAmount != null ? String(invoice.discountAmount) : '0',
      totalAmount:
        invoice.totalAmount != null ? String(invoice.totalAmount) : '0',
    };
  }
}
