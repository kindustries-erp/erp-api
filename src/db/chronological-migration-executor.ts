import { Migration, MigrationExecutor } from 'typeorm';
import { migrationChronologicalKey } from './migration-order';

const compareChronologically = (a: Migration, b: Migration): number => {
  const byDate =
    migrationChronologicalKey(a.name) - migrationChronologicalKey(b.name);
  if (byDate !== 0) return byDate;
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  return a.name.localeCompare(b.name);
};

/**
 * Chạy migration theo thời gian thật của tên file, không theo `parseInt(substr(-13))`
 * của TypeORM. Các hàm khác của TypeORM (show, pending, revert) đều đi qua `getMigrations`
 * nên cũng dùng thứ tự này.
 */
export class ChronologicalMigrationExecutor extends MigrationExecutor {
  protected getMigrations(): Migration[] {
    return [...super.getMigrations()].sort(compareChronologically);
  }
}

export { compareChronologically };
