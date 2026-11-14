import type { DataSource, EntityManager } from 'typeorm';

/**
 * Chạy `work` trong transaction. Có `manager` ngoài thì dùng luôn (orchestrator đang giữ transaction),
 * không có thì tự mở transaction mới như trước. Giữ nguyên hành vi cũ cho mọi lời gọi không truyền `manager`.
 */
export function runInOptionalTransaction<T>(
  dataSource: DataSource,
  manager: EntityManager | undefined,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return manager ? work(manager) : dataSource.transaction(work);
}
