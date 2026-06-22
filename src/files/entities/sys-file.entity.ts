import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_files')
export class SysFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'filename_download', type: 'varchar', length: 255 })
  filename_download: string;

  @Column({ name: 'filename_disk', type: 'varchar', length: 255 })
  filename_disk: string;

  @Column({ name: 'type', type: 'varchar', length: 100 })
  type: string;

  @Column({ name: 'filesize', type: 'int' })
  filesize: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
