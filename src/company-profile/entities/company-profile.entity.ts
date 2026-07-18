import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('company_profile')
export class CompanyProfile {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'ID của hồ sơ công ty' })
  id: string;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  @ApiProperty({ description: 'Tên công ty' })
  company_name: string;

  @Column({ name: 'tax_code', type: 'varchar', length: 50, nullable: true })
  @ApiProperty({ description: 'Mã số thuế', required: false })
  tax_code: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  @ApiProperty({ description: 'Địa chỉ công ty', required: false })
  address: string | null;

  @Column({ name: 'mobi_phone', type: 'varchar', length: 50, nullable: true })
  @ApiProperty({ description: 'Số điện thoại', required: false })
  mobi_phone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  @ApiProperty({ description: 'Email công ty', required: false })
  email: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  @ApiProperty({ description: 'Ghi chú', required: false })
  note: string | null;

  @Column({ name: 'logo', type: 'text', nullable: true })
  @ApiProperty({ description: 'URL hoặc ID của logo', required: false })
  logo: string | null;

  @Column({ name: 'gdt_portal_token', type: 'text', nullable: true })
  @ApiProperty({ description: 'Token đồng bộ Portal GDT', required: false })
  gdt_portal_token: string | null;

  @Column({ name: 'gdt_portal_cookies', type: 'text', nullable: true })
  @ApiProperty({
    description: 'Cookies đồng bộ Portal GDT (WAF bypass)',
    required: false,
  })
  gdt_portal_cookies: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'Thời gian tạo' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'Thời gian cập nhật' })
  updated_at: Date;
}
