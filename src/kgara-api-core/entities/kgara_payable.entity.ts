import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * KGara V2 Payable (export account 331).
 * Composite key: branch_external_id + tai_khoan_id + doi_tac_id + ma_so_tien_te + (ma_so_vu_viec) + period_from + period_to
 */
@Entity({ name: 'kgara_payables' })
@Index(
  'idx_kgara_payables_composite_key',
  [
    'branchExternalId',
    'taiKhoanId',
    'doiTacId',
    'maSoTienTe',
    'maSoVuViec',
    'periodFrom',
    'periodTo',
  ],
  { unique: true },
)
export class KgaraPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Branch/DonViID context for this snapshot */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
  })
  branchExternalId: string;

  /** TaiKhoanID – Account ID */
  @Column({ type: 'varchar', length: 100, name: 'tai_khoan_id' })
  taiKhoanId: string;

  /** MaSoTaiKhoan – usually 331 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'ma_so_tai_khoan',
    nullable: true,
  })
  maSoTaiKhoan: string | null;

  /** TenTaiKhoan */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'ten_tai_khoan',
    nullable: true,
  })
  tenTaiKhoan: string | null;

  /** DoiTacID – Vendor ID */
  @Column({ type: 'varchar', length: 100, name: 'doi_tac_id' })
  doiTacId: string;

  /** MaSoDoiTac – Vendor code */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'ma_so_doi_tac',
    nullable: true,
  })
  maSoDoiTac: string | null;

  /** TenDoiTac – Vendor name */
  @Column({ type: 'varchar', length: 255, name: 'ten_doi_tac', nullable: true })
  tenDoiTac: string | null;

  /** MaSoTienTe – Currency (VND) */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'ma_so_tien_te',
    default: 'VND',
  })
  maSoTienTe: string;

  /** MaSoVuViec – Job/Case ID if any (to be part of composite key) */
  @Column({ type: 'varchar', length: 100, name: 'ma_so_vu_viec', default: '' })
  maSoVuViec: string;

  /** DKNo – Opening debit balance */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'dk_no',
    nullable: true,
  })
  dkNo: number | null;

  /** DKCo – Opening credit balance */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'dk_co',
    nullable: true,
  })
  dkCo: number | null;

  /** PSNo – Period debit movement */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'ps_no',
    nullable: true,
  })
  psNo: number | null;

  /** PSCo – Period credit movement */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'ps_co',
    nullable: true,
  })
  psCo: number | null;

  /** CKNo – Closing debit balance */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'ck_no',
    nullable: true,
  })
  ckNo: number | null;

  /** CKCo – Closing credit balance (Amount payable) */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'ck_co',
    nullable: true,
  })
  ckCo: number | null;

  /** TyGiaCK – Exchange rate */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    name: 'ty_gia_ck',
    nullable: true,
  })
  tyGiaCk: number | null;

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
