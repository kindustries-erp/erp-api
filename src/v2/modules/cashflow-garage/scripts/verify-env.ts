/**
 * Đặt DATABASE_URL từ loader chuẩn (env tường minh, không dùng .env mặc định) trước khi nạp data source.
 * Import file này đầu tiên trong script cần đọc DB.
 */
import { resolveScriptEnv } from '../../../../common/scripts/load-script-env';

const env = resolveScriptEnv({ argv: process.argv.slice(2) });
if (env.isProduction) {
  throw new Error('Từ chối chạy trên DB production trong script xác minh.');
}
process.env.DATABASE_URL = env.databaseUrl;
if (env.ssl === false) process.env.DB_SSL = 'false';
console.log(`TARGET ${env.dbLabel}`);
