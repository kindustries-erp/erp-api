import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'kgara_auth' })
export class KgaraAuth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'access_token', nullable: true })
  accessToken: string | null;

  @Column({ type: 'text', name: 'refresh_token', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'timestamp', name: 'token_expires', nullable: true })
  tokenExpires: Date | null;

  /** Default branch ID returned by login (SS_ClientID). Can be empty string if account has no default branch. */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'ss_client_id',
    nullable: true,
  })
  ssClientId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
