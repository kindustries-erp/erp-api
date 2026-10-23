import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { toInvoiceEntityFields } from '../helpers/invoice.mapper';

/** Ghi dữ liệu: tạo, cập nhật, xóa mềm. Việc kiểm tra tồn tại do Facade đảm nhiệm. */
@Injectable()
export class InvoiceCommandService {
  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
  ) {}

  create(dto: CreateInvoiceDto): Promise<Invoice> {
    const entity = this.repo.create({
      ...toInvoiceEntityFields(dto),
      isDeleted: false,
    });
    return this.repo.save(entity);
  }

  update(entity: Invoice, dto: UpdateInvoiceDto): Promise<Invoice> {
    Object.assign(entity, toInvoiceEntityFields(dto));
    return this.repo.save(entity);
  }

  softDelete(entity: Invoice): Promise<Invoice> {
    entity.isDeleted = true;
    return this.repo.save(entity);
  }
}
