import { QueryRunner } from 'typeorm';
import { CreateEmployeesManagement20261115130000 } from './20261115130000-create-employees-management';

function fakeRunner() {
  const sql: string[] = [];
  const runner = {
    query: jest.fn(async (statement: string) => {
      sql.push(statement.replace(/\s+/g, ' ').trim());
      return [];
    }),
  } as unknown as QueryRunner;
  return { runner, sql };
}

describe('CreateEmployeesManagement20261115130000', () => {
  const migration = new CreateEmployeesManagement20261115130000();

  it('up tạo bảng theo base-core, index partial và FK chi nhánh', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    const all = sql.join('\n');
    expect(all).toContain('CREATE TABLE "employees_management"');
    expect(all).toContain(`"extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    expect(all).toContain('"created_at" timestamptz');
    expect(all).toContain('"birth_date" timestamptz');
    expect(all).toContain('"national_id" varchar(20)');
    expect(all).toContain(
      'UQ_employees_management_code_active" ON "employees_management" ("employee_code") WHERE "is_deleted" = false',
    );
    expect(all).toContain('FK_employees_management_branch_id');
    expect(all).toContain('REFERENCES "erp_branches"("id")');
  });

  it('up lưu liên kết cũ trước khi đặt NULL rồi đổi FK sang bảng mới', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    const idxBackup = sql.findIndex((s) =>
      s.includes('employees_management_legacy_user_links" AS'),
    );
    const idxNull = sql.findIndex((s) =>
      s.startsWith('UPDATE "users_management" SET "employee_id" = NULL'),
    );
    const idxFk = sql.findIndex((s) =>
      s.includes('REFERENCES "employees_management"("id")'),
    );
    expect(idxBackup).toBeGreaterThan(-1);
    expect(idxNull).toBeGreaterThan(idxBackup);
    expect(idxFk).toBeGreaterThan(idxNull);
  });

  it('down trả FK về erp_employees, khôi phục liên kết rồi xóa bảng mới', async () => {
    const { runner, sql } = fakeRunner();
    await migration.down(runner);
    const all = sql.join('\n');
    expect(all).toContain('REFERENCES "erp_employees"("id")');
    expect(all).toContain('FROM "employees_management_legacy_user_links" l');
    expect(sql[sql.length - 1]).toBe(
      'DROP TABLE IF EXISTS "employees_management"',
    );
  });

  it('không backfill từ erp_employees khi up', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    expect(sql.some((s) => /INSERT INTO "employees_management"/.test(s))).toBe(
      false,
    );
  });
});
