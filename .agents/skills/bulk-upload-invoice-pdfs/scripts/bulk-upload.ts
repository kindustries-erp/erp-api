import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Get target directory and direction from arguments
const targetDir = process.argv[2];
const direction = process.argv[3]?.toUpperCase() || 'IN';

if (!targetDir || !['IN', 'OUT'].includes(direction)) {
  console.error(
    'Cách dùng: bun run bulk-upload.ts <thư_mục_chứa_pdf> [IN|OUT]',
  );
  console.error('VD: bun run bulk-upload.ts /path/to/dir IN');
  process.exit(1);
}

const envContent = fs.readFileSync(
  path.join(process.cwd(), 'erp-api', '.env'),
  'utf-8',
);
const envVars = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/['"]/g, '')] as [
        string,
        string,
      ]; // Remove quotes
    }),
);

const accountId = envVars['R2_ACCOUNT_ID'];
const accessKeyId = envVars['R2_ACCESS_KEY_ID'];
const secretAccessKey = envVars['R2_SECRET_ACCESS_KEY'];
const bucket = envVars['R2_BUCKET_NAME']?.trim();
const dbUrl = envVars['DATABASE_URL']?.trim();

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !dbUrl) {
  console.error('Thiếu thông tin R2 credentials hoặc DATABASE_URL trong .env');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const pgClient = new Client({
  connectionString: dbUrl,
});

async function main() {
  await pgClient.connect();
  console.log('Đã kết nối Database');

  const files = fs
    .readdirSync(targetDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'));
  console.log(`Tìm thấy ${files.length} file PDF trong thư mục ${targetDir}`);

  // Lấy tất cả hóa đơn theo direction chưa có pdf_file_key
  const res = await pgClient.query(
    'SELECT id, invoice_no, serial_no, invoice_date FROM erp_invoices WHERE direction = $1 AND pdf_file_key IS NULL',
    [direction],
  );
  const pendingInvoices = res.rows;
  console.log(
    `Tìm thấy ${pendingInvoices.length} hóa đơn ${direction} chưa có PDF.`,
  );

  const processedInvoices = new Set<string>();

  for (const filename of files) {
    const filePath = path.join(targetDir, filename);

    // Tìm hóa đơn khớp với tên file
    // Cách khớp: Tên file phải chứa invoice_no (có word boundary)
    // và (tuỳ chọn) chứa serial_no nếu có.
    const matchedInvoices = pendingInvoices.filter((inv) => {
      // Bỏ đi các ký tự 0 ở đầu nếu có (tuỳ nhu cầu, tạm thời giữ nguyên)
      const invNo = inv.invoice_no;
      const serial = inv.serial_no;

      const noRegex = new RegExp(
        `(^|[^a-zA-Z0-9])${invNo}([^a-zA-Z0-9]|$)`,
        'i',
      );
      const matchNo = noRegex.test(filename);

      let matchSerial = true;
      if (serial) {
        // Có thể serial_no trong file bị thiếu ký tự đầu (vd: 1C26THA -> C26THA)
        // Lấy 5-6 ký tự cuối của serial để match cho chắc chắn
        const shortSerial = serial.length > 5 ? serial.slice(-5) : serial;
        const serialRegex = new RegExp(shortSerial, 'i');
        matchSerial = serialRegex.test(filename);
      }

      return matchNo && matchSerial;
    });

    if (matchedInvoices.length === 0) {
      console.warn(
        `[SKIPPED] Không tìm thấy hóa đơn khớp cho file: ${filename}`,
      );
      continue;
    }

    if (matchedInvoices.length > 1) {
      console.warn(
        `[SKIPPED] Tìm thấy nhiều hơn 1 hóa đơn khớp cho file: ${filename}. Vui lòng xử lý tay.`,
      );
      continue;
    }

    const record = matchedInvoices[0];
    const invoiceNo = record.invoice_no;

    if (processedInvoices.has(record.id)) {
      console.log(
        `[SKIPPED] File trùng lặp của hóa đơn số ${invoiceNo}. Sẽ bị xóa: ${filename}`,
      );
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`[ERROR] Không thể xóa file ${filename}:`, err);
      }
      continue;
    }

    // Tiến hành upload
    const dateObj = new Date(record.invoice_date);
    const year = dateObj.getFullYear().toString();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const r2Key = `invoices/${direction}/${year}/${month}/${filename}`;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: r2Key,
          Body: fileBuffer,
          ContentType: 'application/pdf',
        }),
      );

      // Update database
      await pgClient.query(
        'UPDATE erp_invoices SET pdf_file_key = $1 WHERE id = $2',
        [r2Key, record.id],
      );

      console.log(
        `[SUCCESS] Đã upload và cập nhật hóa đơn số ${invoiceNo} (File: ${filename})`,
      );
      processedInvoices.add(record.id);

      // Xóa file local sau khi thành công
      fs.unlinkSync(filePath);
      console.log(`[DELETED] Đã xóa file local: ${filename}`);
    } catch (error: any) {
      console.error(
        `[ERROR] Lỗi khi xử lý hóa đơn số ${invoiceNo}: ${error.message}`,
      );
    }
  }

  await pgClient.end();
  console.log('Hoàn tất.');
}

main();
