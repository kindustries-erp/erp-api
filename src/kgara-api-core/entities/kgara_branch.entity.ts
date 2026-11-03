import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Cùng một đơn vị Kgara có thể thuộc nhiều tài khoản (ví dụ CN2 ở MAIN và OJ) */
@Index('UQ_kgara_branches_external_account', ['externalId', 'accountKey'], {
  unique: true,
})
@Entity({ name: 'kgara_branches' })
export class KgaraBranch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'external_id' })
  externalId: string;

  /** Account identifier ('MAIN', 'OJ', etc.) */
  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    name: 'account_key',
    default: 'MAIN',
  })
  accountKey: string;

  @Column({ type: 'varchar', length: 100, name: 'code', nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255, name: 'name', nullable: true })
  name: string | null;

  /** ParentID from KGara V2 branch list – org tree support */
  @Column({ type: 'varchar', length: 100, name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
