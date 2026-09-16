import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, LessThanOrEqual, MoreThan } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import {
  ErpSystemOperation,
  SystemOperationModule,
  SystemOperationScope,
} from './entities/erp_system_operation.entity';
import { QuerySystemOperationDto } from './dto/query-operation.dto';

export interface StartOperationOptions {
  module: SystemOperationModule;
  operationType: string;
  scopeType?: SystemOperationScope;
  targetId?: string;
  targetNo?: string;
  userId?: string;
  userName?: string;
  isBlockingUi?: boolean;
  blockedActions?: string[];
  metadata?: Record<string, any>;
  progressData?: Record<string, any>;
  timeoutSeconds?: number;
}

export interface SystemOperationEvent {
  event: 'START' | 'PROGRESS' | 'COMPLETE' | 'FAIL' | 'RELEASE' | 'PING';
  data: Partial<ErpSystemOperation> & { message?: string };
}

@Injectable()
export class SystemOperationsCoreService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SystemOperationsCoreService.name);
  public readonly stream$ = new Subject<SystemOperationEvent>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  // In-Memory Micro-Cache (TTL 2s) để giảm tải 100% DB query khi nhiều client poll đồng thời
  private readonly cacheMap = new Map<
    string,
    { data: ErpSystemOperation[]; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 2000;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpSystemOperation)
    private readonly repository: Repository<ErpSystemOperation>,
  ) {}

  onModuleInit() {
    // Tự động dọn dẹp các lock hết hạn định kỳ mỗi 30s
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredOperations().catch((err) =>
        this.logger.error('Error cleaning up expired system operations:', err),
      );
    }, 30000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cacheMap.clear();
    this.stream$.complete();
  }

  private getCacheKey(query: QuerySystemOperationDto): string {
    return `${query.module || 'ALL'}:${query.scopeType || 'ALL'}:${query.targetId || 'ALL'}:${query.blockingOnly ? '1' : '0'}`;
  }

  /**
   * Xóa toàn bộ In-Memory Cache ngay khi có thay đổi trạng thái tác vụ
   */
  public invalidateCache(): void {
    this.cacheMap.clear();
  }

  private async cleanupExpiredOperations(): Promise<number> {
    const now = new Date();
    const result = await this.repository
      .createQueryBuilder()
      .update(ErpSystemOperation)
      .set({
        status: 'FAILED',
        metadata: () =>
          `COALESCE(metadata, '{}'::jsonb) || '{"expired": true}'::jsonb`,
      })
      .where('status = :status AND expires_at <= :now', {
        status: 'PROCESSING',
        now,
      })
      .execute();

    if (result.affected && result.affected > 0) {
      this.invalidateCache();
      this.logger.log(
        `Auto-expired ${result.affected} stale system operations.`,
      );
      this.stream$.next({
        event: 'RELEASE',
        data: { message: `Auto-expired ${result.affected} operations` },
      });
    }
    return result.affected || 0;
  }

  /**
   * Bắt đầu một tác vụ hệ thống và đăng ký khóa giao dịch (Operation Lock)
   */
  async startOperation(
    options: StartOperationOptions,
    customManager?: any,
  ): Promise<ErpSystemOperation> {
    const repo = customManager
      ? customManager.getRepository(ErpSystemOperation)
      : this.repository;

    const timeoutSec = options.timeoutSeconds || 60;
    const expiresAt = new Date(Date.now() + timeoutSec * 1000);

    // Kiểm tra xem đã có tác vụ nào đang khóa cùng target hoặc cùng module chưa
    const now = new Date();
    const activeConflicts = await repo
      .createQueryBuilder('op')
      .where('op.status = :status AND op.expires_at > :now', {
        status: 'PROCESSING',
        now,
      })
      .andWhere(
        options.targetId
          ? '(op.target_id = :targetId OR (op.module = :module AND op.scope_type = :scopeGlobal))'
          : '(op.module = :module AND op.scope_type IN (:...scopes))',
        {
          targetId: options.targetId,
          module: options.module,
          scopeGlobal: 'GLOBAL',
          scopes: ['GLOBAL', 'MODULE'],
        },
      )
      .getOne();

    if (activeConflicts) {
      const userStr = activeConflicts.userName
        ? ` bởi ${activeConflicts.userName}`
        : '';
      const docStr = activeConflicts.targetNo
        ? ` trên chứng từ ${activeConflicts.targetNo}`
        : '';
      throw new ConflictException(
        `Hệ thống đang bận xử lý giao dịch${docStr}${userStr}. Vui lòng chờ trong giây lát.`,
      );
    }

    const op = repo.create({
      module: options.module,
      operationType: options.operationType,
      scopeType: options.scopeType || 'MODULE',
      targetId: options.targetId || null,
      targetNo: options.targetNo || null,
      userId: options.userId || null,
      userName: options.userName || null,
      status: 'PROCESSING',
      isBlockingUi:
        options.isBlockingUi !== undefined ? options.isBlockingUi : true,
      blockedActions: options.blockedActions || null,
      metadata: options.metadata || null,
      progressData: options.progressData || null,
      expiresAt,
    });

    const saved = await repo.save(op);
    this.invalidateCache();
    this.logger.log(
      `Started System Operation [${saved.id}] ${saved.module}:${saved.operationType} by ${saved.userName || 'System'} (expires in ${timeoutSec}s)`,
    );

    this.stream$.next({
      event: 'START',
      data: saved,
    });

    return saved;
  }

  /**
   * Cập nhật tiến độ % cho tác vụ đang chạy
   */
  async updateProgress(
    id: string,
    progressData: Record<string, any>,
    extendSeconds = 30,
  ): Promise<ErpSystemOperation> {
    const op = await this.repository.findOneBy({ id });
    if (!op || op.status !== 'PROCESSING') {
      throw new NotFoundException('Không tìm thấy tác vụ đang hoạt động');
    }

    op.progressData = { ...(op.progressData || {}), ...progressData };
    op.expiresAt = new Date(Date.now() + extendSeconds * 1000);
    const updated = await this.repository.save(op);
    this.invalidateCache();

    this.stream$.next({
      event: 'PROGRESS',
      data: updated,
    });

    return updated;
  }

  /**
   * Hoàn tất tác vụ và giải phóng khóa
   */
  async completeOperation(
    id: string,
    metadata?: Record<string, any>,
    customManager?: any,
  ): Promise<ErpSystemOperation> {
    const repo = customManager
      ? customManager.getRepository(ErpSystemOperation)
      : this.repository;

    const op = await repo.findOneBy({ id });
    if (!op) return null as any;

    op.status = 'COMPLETED';
    if (metadata) {
      op.metadata = { ...(op.metadata || {}), ...metadata };
    }
    const completed = await repo.save(op);
    this.invalidateCache();

    this.logger.log(
      `Completed System Operation [${id}] ${op.module}:${op.operationType}`,
    );
    this.stream$.next({
      event: 'COMPLETE',
      data: completed,
    });

    return completed;
  }

  /**
   * Đánh dấu tác vụ thất bại và giải phóng khóa
   */
  async failOperation(
    id: string,
    errorMessage?: string,
    customManager?: any,
  ): Promise<ErpSystemOperation> {
    const repo = customManager
      ? customManager.getRepository(ErpSystemOperation)
      : this.repository;

    const op = await repo.findOneBy({ id });
    if (!op) return null as any;

    op.status = 'FAILED';
    op.metadata = { ...(op.metadata || {}), error: errorMessage };
    const failed = await repo.save(op);
    this.invalidateCache();

    this.logger.warn(`Failed System Operation [${id}]: ${errorMessage}`);
    this.stream$.next({
      event: 'FAIL',
      data: failed,
    });

    return failed;
  }

  /**
   * Lấy danh sách các tác vụ đang hoạt động (có Micro-Cache 2s)
   */
  async getActiveOperations(
    query: QuerySystemOperationDto,
  ): Promise<ErpSystemOperation[]> {
    const key = this.getCacheKey(query);
    const cached = this.cacheMap.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const nowDate = new Date(now);
    const qb = this.repository
      .createQueryBuilder('op')
      .where('op.status = :status AND op.expires_at > :now', {
        status: 'PROCESSING',
        now: nowDate,
      })
      .orderBy('op.created_at', 'ASC');

    if (query.module) {
      qb.andWhere('op.module = :module', { module: query.module });
    }
    if (query.scopeType) {
      qb.andWhere('op.scope_type = :scopeType', { scopeType: query.scopeType });
    }
    if (query.targetId) {
      qb.andWhere('op.target_id = :targetId', { targetId: query.targetId });
    }
    if (query.blockingOnly) {
      qb.andWhere('op.is_blocking_ui = true');
    }

    const items = await qb.getMany();
    this.cacheMap.set(key, { data: items, expiresAt: now + this.CACHE_TTL_MS });
    return items;
  }

  /**
   * Kiểm tra xem một hành động cụ thể có đang bị khóa hay không
   */
  async checkActionBlocked(
    moduleName: string,
    actionName?: string,
    targetId?: string,
  ): Promise<{
    isBlocked: boolean;
    lock: ErpSystemOperation | null;
    reason: string | null;
  }> {
    const active = await this.getActiveOperations({
      module: moduleName,
      blockingOnly: true,
    });

    if (active.length === 0) {
      return { isBlocked: false, lock: null, reason: null };
    }

    for (const op of active) {
      // Global scope locks everything
      if (op.scopeType === 'GLOBAL') {
        return {
          isBlocked: true,
          lock: op,
          reason: `Hệ thống đang bảo trì / xử lý toàn cục${op.userName ? ` bởi ${op.userName}` : ''}: ${op.operationType}`,
        };
      }

      // Target document scope locks matching document
      if (op.scopeType === 'DOCUMENT' && targetId && op.targetId === targetId) {
        return {
          isBlocked: true,
          lock: op,
          reason: `Chứng từ ${op.targetNo || targetId} đang được xử lý${op.userName ? ` bởi ${op.userName}` : ''}`,
        };
      }

      // Module scope or action matching
      if (
        op.scopeType === 'MODULE' ||
        !actionName ||
        (op.blockedActions && op.blockedActions.includes(actionName))
      ) {
        const userStr = op.userName ? ` (bởi ${op.userName})` : '';
        const docStr = op.targetNo ? ` cho chứng từ ${op.targetNo}` : '';
        return {
          isBlocked: true,
          lock: op,
          reason: `Hệ thống đang xử lý giao dịch ${op.operationType}${docStr}${userStr}. Vui lòng chờ trong giây lát.`,
        };
      }
    }

    return { isBlocked: false, lock: null, reason: null };
  }
}
