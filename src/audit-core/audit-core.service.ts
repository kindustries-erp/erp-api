import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ErpAuditLog } from './entities/erp-audit-log.entity';
import { AuditLogCoreQueryDto } from './dto/audit-log-core-query.dto';

export interface RecordActionInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorEmployeeId?: string | null;
  actionType: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  route?: string | null;
  httpMethod?: string | null;
  status?: 'SUCCESS' | 'FAIL';
  message?: string | null;
  uiScreen?: string | null;
  uiAction?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  errorSnapshot?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditCoreService {
  constructor(
    @InjectRepository(ErpAuditLog)
    private readonly auditRepository: Repository<ErpAuditLog>,
  ) {}

  async recordAction(input: RecordActionInput): Promise<void> {
    try {
      const row = this.auditRepository.create({
        requestId: input.requestId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorEmployeeId: input.actorEmployeeId ?? null,
        actionType: input.actionType,
        module: input.module,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        route: input.route ?? null,
        httpMethod: input.httpMethod ?? null,
        status: input.status ?? 'SUCCESS',
        message: input.message ?? null,
        uiScreen: input.uiScreen ?? null,
        uiAction: input.uiAction ?? null,
        beforeSnapshot: input.beforeSnapshot ?? null,
        afterSnapshot: input.afterSnapshot ?? null,
        errorSnapshot: input.errorSnapshot ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      await this.auditRepository.save(row);
    } catch {
      // audit must never break business flow
    }
  }

  async findAll(query: AuditLogCoreQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const qb = this.auditRepository.createQueryBuilder('log');

    if (query.module)
      qb.andWhere('log.module = :module', { module: query.module });
    if (query.actionType)
      qb.andWhere('log.actionType = :actionType', {
        actionType: query.actionType,
      });
    if (query.entityType)
      qb.andWhere('log.entityType = :entityType', {
        entityType: query.entityType,
      });
    if (query.entityId)
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    if (query.actorUserId)
      qb.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    if (query.status)
      qb.andWhere('log.status = :status', { status: query.status });
    if (query.dateFrom)
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo)
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: query.dateTo });
    if (query.search) {
      qb.andWhere(
        '(log.actorEmail ILIKE :search OR log.entityId ILIKE :search OR log.message ILIKE :search OR log.route ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getEntityTimeline(entityType: string, entityId: string) {
    return this.auditRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }
}
