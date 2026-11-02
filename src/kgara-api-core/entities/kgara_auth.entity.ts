import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'kgara_auth' })
export class KgaraAuth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Account identifier ('MAIN', 'OJ', etc.) */
  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 50,
    name: 'account_key',
    default: 'MAIN',
  })
  accountKey: string;

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
