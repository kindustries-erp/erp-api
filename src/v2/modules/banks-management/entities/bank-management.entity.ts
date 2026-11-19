import { Entity, Index } from 'typeorm';
import { BaseBankEntity } from '@/v2/core/banks-core';

/**
 * Danh mục ngân hàng toàn hệ thống (V2).
 * Kế thừa BaseBankEntity từ banks-core (và CoreSoftDeletableEntity từ base-core).
 * Bảng `banks_management` theo quy ước chuẩn V2: snake_case <gốc>_<hậu tố>, không prefix erp_.
 */
@Entity({ name: 'banks_management' })
@Index('UQ_banks_management_code_active', ['code'], {
  unique: true,
  where: '"is_deleted" = false',
})
@Index('idx_banks_management_bin', ['bin'])
@Index('idx_banks_management_is_active', ['isActive'])
export class BankManagement extends BaseBankEntity {}
