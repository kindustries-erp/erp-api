import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * KGara V2 case record (HdPhieuDichVu).
 * Generic English columns kept for backward compat.
 * Typed Vietnamese columns added for V2 field mapping.
 */
@Entity({ name: 'kgara_cases' })
export class KgaraCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** HdPhieuDichVuID – case primary key from KGara */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, name: 'hd_phieu_dich_vu_id' })
  hdPhieuDichVuId: string;

  // ── V2 typed columns ──────────────────────────────────────────────────────

  /** SoChungTu – case/document number */
  @Column({ type: 'varchar', length: 100, name: 'so_chung_tu', nullable: true })
  soChungTu: string | null;

  /** BienSoXe – vehicle license plate */
  @Column({ type: 'varchar', length: 50, name: 'bien_so_xe', nullable: true })
  bienSoXe: string | null;

  /** KhachHangCode – customer code */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'khach_hang_code',
    nullable: true,
  })
  khachHangCode: string | null;

  /** KhachHangName – customer name */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'khach_hang_name',
    nullable: true,
  })
  khachHangName: string | null;

  /** TinhTrangDichVu – service status code (0=intake,1=quote,2=wip,3=done,9=cancelled) */
  @Column({ type: 'int', name: 'tinh_trang_dich_vu', nullable: true })
  tinhTrangDichVu: number | null;

  /** TenTinhTrangDichVu – service status label */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'ten_tinh_trang_dich_vu',
    nullable: true,
  })
  tenTinhTrangDichVu: string | null;

  /** TienCoThue – total amount after tax */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_co_thue',
    nullable: true,
  })
  tienCoThue: number | null;

  /** TienDaThanhToan – total paid */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_da_thanh_toan',
    nullable: true,
  })
  tienDaThanhToan: number | null;

  /** TienConPhaiThanhToan – outstanding receivable */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_con_phai_thanh_toan',
    nullable: true,
  })
  tienConPhaiThanhToan: number | null;

  /** NgayPhatSinh – case transaction date */
  @Column({ type: 'timestamp', name: 'ngay_phat_sinh', nullable: true })
  ngayPhatSinh: Date | null;

  /** dataAsOf – server-side timestamp from response envelope */
  @Column({
    type: 'timestamp with time zone',
    name: 'data_as_of',
    nullable: true,
  })
  dataAsOf: Date | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
    nullable: true,
  })
  branchExternalId: string | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
