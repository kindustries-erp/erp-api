import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FileCategory,
  FileOwnerRegistry,
  FileOwnerType,
  type FileOwnerPolicyPort,
} from '@/v2/core/storage-core';
import { FinanceInvoice } from '../entities/finance-invoice.entity';

/**
 * Owner `INVOICE` của module file. V1 không khóa việc thêm/xóa file theo trạng thái hóa đơn,
 * nên V2 giữ nguyên hành vi đó (chỉ yêu cầu hóa đơn còn tồn tại).
 */
@Injectable()
export class InvoiceFileOwnerPolicy
  implements FileOwnerPolicyPort, OnModuleInit
{
  readonly ownerType = FileOwnerType.INVOICE;

  constructor(
    @InjectRepository(FinanceInvoice)
    private readonly invoices: Repository<FinanceInvoice>,
    private readonly registry: FileOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  allowedCategories(): FileCategory[] {
    return [
      FileCategory.HOA_DON,
      FileCategory.BANG_KE,
      FileCategory.HOP_DONG,
      FileCategory.KHAC,
    ];
  }

  async assertExists(ownerId: string): Promise<void> {
    const found = await this.invoices.exists({
      where: { id: ownerId, isDeleted: false },
    });
    if (!found) throw new NotFoundException('Không tìm thấy hóa đơn');
  }

  async assertCanModify(): Promise<void> {
    // Không khóa theo trạng thái (khớp V1). Owner khác (Garage PR) sẽ siết ở đây.
  }
}
