import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum GwSyncStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

@Entity({ name: 'kgara_sync_runs' })
export class GwSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
    nullable: true,
  })
  branchExternalId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'endpoint' })
  endpoint: string;

  @Column({ type: 'jsonb', name: 'query_params', nullable: true })
  queryParams: any;

  @Column({ type: 'int', name: 'page_size', nullable: true })
  pageSize: number | null;

  @Column({ type: 'timestamp with time zone', name: 'request_started_at' })
  requestStartedAt: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'request_ended_at',
    nullable: true,
  })
  requestEndedAt: Date | null;

  @Column({ type: 'int', name: 'response_status', nullable: true })
  responseStatus: number | null;

  @Column({ type: 'text', name: 'response_message', nullable: true })
  responseMessage: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'data_as_of',
    nullable: true,
  })
  dataAsOf: Date | null;

  @Column({ type: 'int', name: 'row_count', default: 0 })
  rowCount: number;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({
    type: 'enum',
    enum: GwSyncStatus,
    name: 'status',
    default: GwSyncStatus.SUCCESS,
  })
  status: GwSyncStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
