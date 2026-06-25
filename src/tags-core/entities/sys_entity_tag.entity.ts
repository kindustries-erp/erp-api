import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'sys_entity_tags' })
@Index(['entityType', 'entityId'])
@Index(['tagId', 'entityType', 'entityId'], { unique: true })
export class SysEntityTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tag_id' })
  tagId: string;

  @Column({ type: 'varchar', length: 255, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
