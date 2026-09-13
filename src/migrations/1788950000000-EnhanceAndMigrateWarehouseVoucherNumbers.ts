import { MigrationInterface, QueryRunner } from 'typeorm';

function formatYmdGMT7(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${partMap.year}${partMap.month}${partMap.day}`;
}

export class EnhanceAndMigrateWarehouseVoucherNumbers1788950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Goods Receipts Migration
    const receipts = await queryRunner.query(`
      SELECT id, receipt_no, receipt_date, created_at
      FROM erp_goods_receipts
      ORDER BY receipt_date ASC, created_at ASC, id ASC
    `);

    const receiptCounters = new Map<string, number>();
    for (const r of receipts) {
      const ymd = formatYmdGMT7(r.receipt_date);
      const nextSeq = (receiptCounters.get(ymd) || 0) + 1;
      receiptCounters.set(ymd, nextSeq);
      const newReceiptNo = `NK-${ymd}-${String(nextSeq).padStart(3, '0')}`;

      await queryRunner.query(
        `UPDATE erp_goods_receipts SET receipt_no = $1 WHERE id = $2`,
        [newReceiptNo, r.id],
      );

      // Update matching notes in inventory transactions if referenced
      if (r.receipt_no && r.receipt_no !== newReceiptNo) {
        await queryRunner.query(
          `UPDATE erp_inventory_transactions 
           SET notes = REPLACE(notes, $1, $2)
           WHERE document_id = $3 AND notes LIKE $4`,
          [r.receipt_no, newReceiptNo, r.id, `%${r.receipt_no}%`],
        );
      }
    }

    // 2. Goods Issues Migration
    const issues = await queryRunner.query(`
      SELECT id, issue_no, issue_date, created_at
      FROM erp_goods_issues
      ORDER BY issue_date ASC, created_at ASC, id ASC
    `);

    const issueCounters = new Map<string, number>();
    for (const i of issues) {
      const ymd = formatYmdGMT7(i.issue_date);
      const nextSeq = (issueCounters.get(ymd) || 0) + 1;
      issueCounters.set(ymd, nextSeq);
      const newIssueNo = `XK-${ymd}-${String(nextSeq).padStart(3, '0')}`;

      await queryRunner.query(
        `UPDATE erp_goods_issues SET issue_no = $1 WHERE id = $2`,
        [newIssueNo, i.id],
      );

      // Update matching notes in inventory transactions if referenced
      if (i.issue_no && i.issue_no !== newIssueNo) {
        await queryRunner.query(
          `UPDATE erp_inventory_transactions 
           SET notes = REPLACE(notes, $1, $2)
           WHERE document_id = $3 AND notes LIKE $4`,
          [i.issue_no, newIssueNo, i.id, `%${i.issue_no}%`],
        );
      }
    }

    // 3. Inventory Adjustments Migration
    const adjustments = await queryRunner.query(`
      SELECT id, adjustment_no, adjustment_date, created_at
      FROM erp_inventory_adjustments
      ORDER BY adjustment_date ASC, created_at ASC, id ASC
    `);

    const adjCounters = new Map<string, number>();
    for (const a of adjustments) {
      const ymd = formatYmdGMT7(a.adjustment_date);
      const nextSeq = (adjCounters.get(ymd) || 0) + 1;
      adjCounters.set(ymd, nextSeq);
      const newAdjustmentNo = `DC-${ymd}-${String(nextSeq).padStart(3, '0')}`;

      await queryRunner.query(
        `UPDATE erp_inventory_adjustments SET adjustment_no = $1 WHERE id = $2`,
        [newAdjustmentNo, a.id],
      );

      // Update matching notes in inventory transactions if referenced
      if (a.adjustment_no && a.adjustment_no !== newAdjustmentNo) {
        await queryRunner.query(
          `UPDATE erp_inventory_transactions 
           SET notes = REPLACE(notes, $1, $2)
           WHERE document_id = $3 AND notes LIKE $4`,
          [a.adjustment_no, newAdjustmentNo, a.id, `%${a.adjustment_no}%`],
        );
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Migration modifies existing string codes in-place; irreversible without snapshot table
  }
}
