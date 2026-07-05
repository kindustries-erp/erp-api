import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * KGara V2 Receivable (export).
 * Composite key: branch_external_id + hd_phieu_dich_vu_id + so_chung_tu + period_from + period_to
 */
@Entity({ name: 'kgara_receivables' })
@Index(
  'idx_kgara_receivables_composite_key',
  [
    'branchExternalId',
    'hdPhieuDichVuId',
    'soChungTu',
    'periodFrom',
    'periodTo',
  ],
  { unique: true },
)
export class KgaraReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Branch/DonViID context for this snapshot */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
  })
  branchExternalId: string;

  /** HdPhieuDichVuID – case foreign key */
  @Column({ type: 'varchar', length: 100, name: 'hd_phieu_dich_vu_id' })
  hdPhieuDichVuId: string;

  /** SoChungTu – case/document number */
  @Column({ type: 'varchar', length: 100, name: 'so_chung_tu', nullable: true })
  soChungTu: string | null;

  /** KhachHangCode – customer code */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'khach_hang_code',
    nullable: true,
  })
  khachHangCode: string | null;

  /** KhachHangName / TenKhachHang – customer name */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'khach_hang_name',
    nullable: true,
  })
  khachHangName: string | null;

  /** BienSoXe – vehicle license plate */
  @Column({ type: 'varchar', length: 50, name: 'bien_so_xe', nullable: true })
  bienSoXe: string | null;

  /** TienThanhToan – total receivable amount */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_thanh_toan',
    nullable: true,
  })
  tienThanhToan: number | null;

  /** TienDaThanhToan – amount already collected */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_da_thanh_toan',
    nullable: true,
  })
  tienDaThanhToan: number | null;

  /** NgayPhatSinh – case transaction date */
  @Column({ type: 'timestamp', name: 'ngay_phat_sinh', nullable: true })
  ngayPhatSinh: Date | null;

  /** Date range "from" used in API query (for snapshot context) */
  @Column({ type: 'date', name: 'period_from', nullable: true })
  periodFrom: Date | null;

  /** Date range "to" used in API query (for snapshot context) */
  @Column({ type: 'date', name: 'period_to', nullable: true })
  periodTo: Date | null;

  /** dataAsOf – server-side timestamp from response envelope */
  @Column({
    type: 'timestamp with time zone',
    name: 'data_as_of',
    nullable: true,
  })
  dataAsOf: Date | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
