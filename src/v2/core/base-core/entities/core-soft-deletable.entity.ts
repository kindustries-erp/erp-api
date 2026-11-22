import { Column, Index } from 'typeorm';
import { CoreAuditedEntity } from './core-audited.entity';

/** Xóa mềm theo quy chuẩn ERP: `is_deleted`, có index. */
export abstract class CoreSoftDeletableEntity extends CoreAuditedEntity {
  @Index()
  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;
}
