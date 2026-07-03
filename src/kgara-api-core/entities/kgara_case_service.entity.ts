import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * KGara V2 case line (ListPhieuDichVuChiTiet).
 * externalId = HdPhieuDichVuChiTietID.
 */
@Entity({ name: 'kgara_case_services' })
export class KgaraCaseService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** HdPhieuDichVuChiTietID – line primary key from KGara */
  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 100,
    name: 'hd_phieu_dich_vu_chi_tiet_id',
  })
  hdPhieuDichVuChiTietId: string;

  /** HdPhieuDichVuID – parent case foreign key */
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'hd_phieu_dich_vu_id' })
  hdPhieuDichVuId: string;

  // ── V2 typed columns ───────────────────────────────────────────────────────

  /** NoiDungChiTiet / TenSanPhamDichVu – line description */
  @Column({ type: 'text', name: 'noi_dung_chi_tiet', nullable: true })
  noiDungChiTiet: string | null;

  /** SanPhamCode – product/service code */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'san_pham_code',
    nullable: true,
  })
  sanPhamCode: string | null;

  /** SanPhamName – product/service name */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'san_pham_name',
    nullable: true,
  })
  sanPhamName: string | null;

  /** LoaiSanPhamCode – product type code (e.g. "PT" = parts, "DV" = service) */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'loai_san_pham_code',
    nullable: true,
  })
  loaiSanPhamCode: string | null;

  /** DonViTinhText – unit of measure */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'don_vi_tinh_text',
    nullable: true,
  })
  donViTinhText: string | null;

  /** SoLuongHoaDon – invoice quantity */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    name: 'so_luong_hoa_don',
    nullable: true,
  })
  soLuongHoaDon: number | null;

  /** DonGia – unit price before tax */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'don_gia',
    nullable: true,
  })
  donGia: number | null;

  /** TienChuaThue – amount before tax */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_chua_thue',
    nullable: true,
  })
  tienChuaThue: number | null;

  /** ThueSuat – VAT rate % */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'thue_suat',
    nullable: true,
  })
  thueSuat: number | null;

  /** TienCoThue – amount after tax */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'tien_co_thue',
    nullable: true,
  })
  tienCoThue: number | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
