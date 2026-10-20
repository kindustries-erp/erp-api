import 'dotenv/config';
import dataSource from './data-source';
import { ChronologicalMigrationExecutor } from './chronological-migration-executor';

/**
 * CLI chạy migration theo thời gian thật của tên file.
 *   run  — áp dụng toàn bộ migration pending (transaction theo cấu hình DataSource)
 *   show — liệt kê pending, không ghi gì
 * Thoát khác 0 khi lỗi, để pipeline (Komodo, Dockerfile.migrate) dừng đúng lúc.
 */
const usage = 'Usage: run-migrations.ts <run|show>';

const main = async (command: string): Promise<void> => {
  await dataSource.initialize();
  try {
    const executor = new ChronologicalMigrationExecutor(dataSource);

    if (command === 'show') {
      const pending = await executor.getPendingMigrations();
      console.log(`Pending: ${pending.length}`);
      pending.forEach((migration) => console.log(`[ ] ${migration.name}`));
      return;
    }

    const applied = await executor.executePendingMigrations();
    console.log(`Applied: ${applied.length}`);
    applied.forEach((migration) => console.log(`[X] ${migration.name}`));
  } finally {
    await dataSource.destroy();
  }
};

const command = process.argv[2] ?? 'run';
if (command !== 'run' && command !== 'show') {
  console.error(usage);
  process.exit(2);
}

main(command).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
