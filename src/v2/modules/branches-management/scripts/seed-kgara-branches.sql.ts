/** Logic seed chi nhánh Kgara -> branches_management (tách khỏi main để test bằng client giả). */

export interface SeedClient {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface KgaraCandidate {
  external_id: string;
  account_key: string;
  code: string;
  name: string;
  cases: number;
}

export interface SeedRow {
  code: string;
  name: string;
  externalId: string;
  accountKey: string;
  cases: number;
  branch: 'CREATED' | 'EXISTING';
  link: 'CREATED' | 'EXISTING';
}

export const SOURCE = 'KGARA';

/** Cặp (external_id, account_key) có vụ việc thật; HT/Root không có dữ liệu nên không lọt vào. */
export const CANDIDATES_SQL = `
  SELECT kb.external_id, kb.account_key, kb.code, kb.name, count(c.*)::int AS cases
  FROM kgara_branches kb
  JOIN kgara_cases c
    ON c.branch_external_id = kb.external_id AND c.account_key = kb.account_key
  GROUP BY kb.external_id, kb.account_key, kb.code, kb.name
  ORDER BY kb.code`;

const FIND_BRANCH_SQL = `SELECT id FROM branches_management WHERE code = $1 AND is_deleted = false`;
const INSERT_BRANCH_SQL = `INSERT INTO branches_management (code, name, is_active) VALUES ($1, $2, true) RETURNING id`;
const INSERT_LINK_SQL = `
  INSERT INTO branches_management_external_links (branch_id, source, external_id, account_key)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (source, external_id, account_key) WHERE is_deleted = false DO NOTHING
  RETURNING id`;

/** Chạy trong transaction do script-db quản lý; idempotent theo mã chi nhánh và khóa liên kết. */
export async function runSeed(client: SeedClient): Promise<SeedRow[]> {
  const candidates = (await client.query<KgaraCandidate>(CANDIDATES_SQL)).rows;
  const rows: SeedRow[] = [];
  for (const c of candidates) {
    const found = await client.query<{ id: string }>(FIND_BRANCH_SQL, [c.code]);
    let branchId = found.rows[0]?.id;
    let branch: SeedRow['branch'] = 'EXISTING';
    if (!branchId) {
      const inserted = await client.query<{ id: string }>(INSERT_BRANCH_SQL, [
        c.code,
        c.name,
      ]);
      branchId = inserted.rows[0].id;
      branch = 'CREATED';
    }
    const link = await client.query<{ id: string }>(INSERT_LINK_SQL, [
      branchId,
      SOURCE,
      c.external_id,
      c.account_key,
    ]);
    rows.push({
      code: c.code,
      name: c.name,
      externalId: c.external_id,
      accountKey: c.account_key,
      cases: c.cases,
      branch,
      link: link.rows.length > 0 ? 'CREATED' : 'EXISTING',
    });
  }
  return rows;
}
