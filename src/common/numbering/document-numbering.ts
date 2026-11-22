import { EntityManager, EntityTarget } from 'typeorm';

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** YYYYMMDD theo giờ VN. Ngày không hợp lệ thì dùng thời điểm hiện tại. */
export function formatVnDateCompact(input?: string | Date): string {
  const parsed =
    input instanceof Date ? input : input ? new Date(input) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/-/g, '');
}

/**
 * Sinh số chứng từ kế tiếp dạng PREFIX-YYYYMMDD-001.
 * Khóa advisory theo tiền tố + ngày trong transaction, nên hai request đồng thời
 * không nhận cùng số. Phải gọi trong transaction (manager của transaction).
 */
export async function nextDocumentNo<T extends object>(
  manager: EntityManager,
  target: EntityTarget<T>,
  field: keyof T & string,
  prefix: string,
  date?: string | Date,
): Promise<string> {
  const base = `${prefix}-${formatVnDateCompact(date)}-`;
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [base]);

  const latest = await manager
    .getRepository(target)
    .createQueryBuilder('doc')
    .select(`doc.${field}`, 'no')
    .where(`doc.${field} LIKE :prefix`, { prefix: `${base}%` })
    .orderBy(`doc.${field}`, 'DESC')
    .getRawOne<{ no: string }>();

  const current = latest ? Number(latest.no.slice(base.length)) : 0;
  const seq = Number.isFinite(current) ? current : 0;
  return `${base}${String(seq + 1).padStart(3, '0')}`;
}
