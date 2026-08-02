import AppDataSource from './src/db/data-source.cli';

async function run() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.query(`UPDATE "erp_attachments" SET "module" = 'Hóa đơn' FROM "erp_invoice_attachments" WHERE "erp_attachments"."id" = "erp_invoice_attachments"."attachment_id"`);
    console.log('Fixed module for invoice attachments successfully');
  } catch (e) {
    console.log('Error:', e.message);
  }
  await AppDataSource.destroy();
}
run();
