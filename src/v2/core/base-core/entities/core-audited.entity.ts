import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CoreBaseEntity } from './core-base.entity';

/** Thêm cặp timestamp `timestamptz` cho entity có vòng đời được ghi nhận. */
export abstract class CoreAuditedEntity extends CoreBaseEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
