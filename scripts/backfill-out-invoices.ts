import { Client } from 'pg';
import * as dotenv from 'dotenv';
import {
  resolveOutInvoiceBranchCode,
  classifyInvoiceLine,
} from '../src/erp-invoices-core/helpers/out-invoice-display.helper';

// Load environment variables
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

async function run() {
  console.log(`Starting backfill out-invoices... (DRY_RUN=${DRY_RUN})`);

  const client = new Client({
    connectionString: DATABASE_URL as string,
    ssl: (DATABASE_URL as string).includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
  });

  await client.connect();
  console.log('Connected to database.');

  try {
    // --- BƯỚC A: Backfill branchId ---
    console.log('\n--- BƯỚC A: Backfill branchId ---');
    
    const branchesRes = await client.query('SELECT id, code FROM erp_branches');
    const branches = new Map(branchesRes.rows.map((b) => [b.code, b.id]));

    const outInvoicesRes = await client.query(`
      SELECT id, invoice_no, settlement_order, buyer_tax_code, branch_id
      FROM erp_invoices
      WHERE direction = 'OUT'
    `);
    
    let branchUpdatedCount = 0;
    let branchUnchangedCount = 0;

    for (const inv of outInvoicesRes.rows) {
      const code = resolveOutInvoiceBranchCode(
        inv.settlement_order,
        inv.buyer_tax_code,
      );
      const expectedBranchId = branches.get(code);

      if (expectedBranchId && inv.branch_id !== expectedBranchId) {
        if (!DRY_RUN) {
          await client.query(
            'UPDATE erp_invoices SET branch_id = $1 WHERE id = $2',
            [expectedBranchId, inv.id],
          );
        }
        console.log(`[Branch] ${inv.invoice_no}: ${inv.branch_id} -> ${expectedBranchId} (${code})`);
        branchUpdatedCount++;
      } else {
        branchUnchangedCount++;
      }
    }
    
    console.log(`BƯỚC A Hoàn tất. Changed: ${branchUpdatedCount}, Unchanged: ${branchUnchangedCount}`);

    // --- BƯỚC B & C: Backfill invoice_category and normalize negative amounts ---
    console.log('\n--- BƯỚC B & C: Normalize items and set invoice_category ---');
    
    const itemsRes = await client.query(`
      SELECT 
        i.id as item_id,
        i.invoice_id,
        i.description,
        i.unit,
        i.quantity,
        i.unit_price,
        i.pre_vat_amount,
        i.vat_amount,
        i.total_amount,
        i.discount_amount,
        i.invoice_subcategory,
        inv.invoice_no,
        inv.buyer_tax_code,
        inv.direction,
        inv.tax_invoice_status,
        inv.discount_amount as header_discount_amount,
        (SELECT COUNT(*) FROM erp_invoice_items ii WHERE ii.invoice_id = inv.id) as line_count
      FROM erp_invoice_items i
      JOIN erp_invoices inv ON i.invoice_id = inv.id
      -- We now check all items (both IN and OUT) for RESCUE, and OUT for DISCOUNT
    `);

    let itemUpdatedCount = 0;
    let itemUnchangedCount = 0;

    for (const row of itemsRes.rows) {
      const original = {
        description: row.description,
        unit: row.unit,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        preVatAmount: row.pre_vat_amount,
        vatAmount: row.vat_amount,
        totalAmount: row.total_amount,
        discountAmount: row.discount_amount,
      };

      const normalized = classifyInvoiceLine(
        original,
        {
          buyerTaxCode: row.buyer_tax_code,
          direction: row.direction,
          invoiceLineCount: parseInt(row.line_count, 10),
          taxInvoiceStatus: row.tax_invoice_status != null ? parseInt(row.tax_invoice_status, 10) : null,
          headerDiscountAmount: Number(row.header_discount_amount) || 0
        }
      );

      // Check if anything changed
      const changed = 
        String(row.invoice_subcategory || 'NORMAL') !== String(normalized.invoiceSubcategory) ||
        Number(original.preVatAmount) !== normalized.preVatAmount ||
        Number(original.vatAmount) !== normalized.vatAmount ||
        Number(original.totalAmount) !== normalized.totalAmount ||
        Number(original.discountAmount) !== normalized.discountAmount;

      if (changed) {
        if (!DRY_RUN) {
          await client.query(`
            UPDATE erp_invoice_items 
            SET 
              invoice_subcategory = $1,
              pre_vat_amount = $2,
              vat_amount = $3,
              total_amount = $4,
              discount_amount = $5
            WHERE id = $6
          `, [
            normalized.invoiceSubcategory,
            normalized.preVatAmount,
            normalized.vatAmount,
            normalized.totalAmount,
            normalized.discountAmount,
            row.item_id
          ]);
        }
        console.log(`[Item] Invoice ${row.invoice_no} (${row.description}): Category: ${row.invoice_subcategory} -> ${normalized.invoiceSubcategory}, preVat: ${original.preVatAmount} -> ${normalized.preVatAmount}`);
        itemUpdatedCount++;
      } else {
        itemUnchangedCount++;
      }
    }
    
    console.log(`BƯỚC B & C Hoàn tất. Changed: ${itemUpdatedCount}, Unchanged: ${itemUnchangedCount}`);

  } catch (err) {
    console.error('Error during backfill:', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

run();
