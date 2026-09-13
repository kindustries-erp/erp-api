import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KgaraCase } from './kgara_case.entity';

@Entity({ name: 'kgara_gross_profit' })
export class KgaraGrossProfit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Foreign key to kgara_cases.hd_phieu_dich_vu_id */
  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 100,
    name: 'hd_phieu_dich_vu_id',
    unique: true,
  })
  hdPhieuDichVuId: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
    nullable: true,
  })
  branchExternalId: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'vu_viec_code',
    nullable: true,
  })
  vuViecCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'vu_viec_name',
    nullable: true,
  })
  vuViecName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'ten_khach_hang',
    nullable: true,
  })
  tenKhachHang: string | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'doanh_thu',
    nullable: true,
  })
  doanhThu: number | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'chi_phi',
    nullable: true,
  })
  chiPhi: number | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'loi_nhuan',
    nullable: true,
  })
  loiNhuan: number | null;

  @Column({ type: 'date', name: 'report_from', nullable: true })
  reportFrom: string | null;

  @Column({ type: 'date', name: 'report_to', nullable: true })
  reportTo: string | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => KgaraCase, { createForeignKeyConstraints: false })
  @JoinColumn({
    name: 'hd_phieu_dich_vu_id',
    referencedColumnName: 'hdPhieuDichVuId',
  })
  kgaraCase: KgaraCase;
}
