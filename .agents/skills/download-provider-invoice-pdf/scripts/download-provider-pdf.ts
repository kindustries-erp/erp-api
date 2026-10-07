import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { HiloInvoiceAdapter } from '../../../../src/erp-invoices-core/services/adapters/hilo-invoice.adapter';
import { MisaInvoiceAdapter } from '../../../../src/erp-invoices-core/services/adapters/misa-invoice.adapter';
import { CyberbillInvoiceAdapter } from '../../../../src/erp-invoices-core/services/adapters/cyberbill-invoice.adapter';
import { InvoiceCaptchaSolverService } from '../../../../src/erp-invoices-core/services/original-pdf/invoice-captcha-solver.service';

// Helper parse env
function parseEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

// Bóc tách mã tra cứu từ XML
function extractMetadataFromXml(xmlContent: string) {
  let hiloKey: string | null = null;
  let misaKey: string | null = null;
  let cyberbillKey: string | null = null;
  let providerGuess: 'HILO' | 'MISA' | 'CYBERBILL' | 'UNKNOWN' = 'UNKNOWN';

  // 1. Kiểm tra HILO / GSM
  const hiloMatch = xmlContent.match(/<TTruong>Hilo-SearchKey<\/TTruong>\s*<DLieu>([^<]+)<\/DLieu>/i);
  if (hiloMatch) {
    hiloKey = hiloMatch[1].trim();
    providerGuess = 'HILO';
  }

  // 2. Kiểm tra CyberBill (CyberLotus)
  const isCyberMst = xmlContent.includes('<MSTTCGP>0105232093</MSTTCGP>') || xmlContent.includes('<MSTTCGP>0108399589</MSTTCGP>');
  const cyberDlMatch = xmlContent.match(/<DLHDon[^>]*Id="ID-([^"]+)"/i);
  if (isCyberMst || cyberDlMatch) {
    providerGuess = 'CYBERBILL';
    if (cyberDlMatch) {
      cyberbillKey = cyberDlMatch[1].trim();
    }
  }

  // 3. Kiểm tra MISA meInvoice
  if (providerGuess === 'UNKNOWN') {
    const misaDlMatch = xmlContent.match(/<DLHDon[^>]*Id="([^"]+)"/i);
    const misaTagMatch = xmlContent.match(/<TTruong>TransactionID<\/TTruong>\s*<DLieu>([^<]+)<\/DLieu>/i);
    if (misaTagMatch) {
      misaKey = misaTagMatch[1].trim();
      providerGuess = 'MISA';
    } else if (misaDlMatch && misaDlMatch[1].length >= 10 && !misaDlMatch[1].startsWith('ID-')) {
      misaKey = misaDlMatch[1].trim();
      providerGuess = 'MISA';
    } else if (xmlContent.includes('meinvoice.vn') || xmlContent.includes('0101243150')) {
      providerGuess = 'MISA';
    }
  }

  return { hiloKey, misaKey, cyberbillKey, providerGuess };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
  };
  const hasFlag = (flag: string) => args.includes(flag);

  const invoiceId = getArg('--id');
  const month = getArg('--month'); // e.g. 2026-10
  const providerFilter = (getArg('--provider') || 'all').toUpperCase(); // HILO, MISA, ALL
  const limit = parseInt(getArg('--limit') || '50', 10);
  const dryRun = hasFlag('--dry-run');

  const envPath = path.resolve(__dirname, '../../../../.env');
  console.log(`[INFO] Nạp cấu hình từ: ${envPath}`);
  const envVars = parseEnv(envPath);

  const dbUrl = envVars['DATABASE_URL'];
  if (!dbUrl) {
    console.error('[ERROR] Không tìm thấy DATABASE_URL trong .env!');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    ssl: false,
  });
  await ds.initialize();
  console.log('[INFO] Kết nối PostgreSQL thành công.');

  const s3Endpoint = envVars['R2_ENDPOINT'] || 'https://s3.liouni.com/';
  const s3Bucket = envVars['R2_BUCKET_NAME'] || 'erp-greenway-production';
  const s3 = new S3Client({
    region: 'auto',
    endpoint: s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: envVars['R2_ACCESS_KEY_ID'] || '',
      secretAccessKey: envVars['R2_SECRET_ACCESS_KEY'] || '',
    },
  });

  const dummyRegistry: any = { register: () => {} };
  const hiloAdapter = new HiloInvoiceAdapter(dummyRegistry);
  const misaAdapter = new MisaInvoiceAdapter(dummyRegistry);
  const captchaSolver = new InvoiceCaptchaSolverService({
    get: (k: string) => envVars[k] || null,
  } as any);
  const cyberbillAdapter = new CyberbillInvoiceAdapter(dummyRegistry, captchaSolver);

  let query = `
    SELECT id, invoice_no, serial_no, invoice_date, seller_name, seller_tax_code,
           lookup_code, lookup_url, provider_code, xml_file_key, pdf_file_key, pdf_source
    FROM erp_invoices
    WHERE 1=1
  `;
  const params: any[] = [];

  if (invoiceId) {
    params.push(invoiceId);
    query += ` AND id = $${params.length}`;
  } else {
    if (month) {
      params.push(`${month}-01`);
      params.push(`${month}-31 23:59:59`);
      query += ` AND invoice_date >= $${params.length - 1} AND invoice_date <= $${params.length}`;
    }
    // Chỉ lấy hóa đơn chưa có PDF gốc hoặc có lỗi
    query += ` AND (pdf_source IS NULL OR pdf_source != 'provider_original' OR pdf_file_key IS NULL)`;
    params.push(limit);
    query += ` ORDER BY invoice_date DESC LIMIT $${params.length}`;
  }

  const invoices = await ds.query(query, params);
  console.log(`[INFO] Tìm thấy ${invoices.length} hóa đơn cần kiểm tra.`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    console.log(`\n------------------------------------------------------------`);
    console.log(`[${i + 1}/${invoices.length}] Hóa đơn ${inv.invoice_no} (${inv.serial_no}) - Ngày: ${inv.invoice_date?.toISOString?.()?.slice(0, 10)}`);
    console.log(`Bên bán: ${inv.seller_name} (MST: ${inv.seller_tax_code})`);

    // 1. Đọc XML
    let xmlContent: string | null = null;
    if (inv.xml_file_key) {
      try {
        const getObj = await s3.send(
          new GetObjectCommand({
            Bucket: s3Bucket,
            Key: inv.xml_file_key,
          }),
        );
        xmlContent = await getObj.Body?.transformToString?.() || null;
      } catch (err: any) {
        console.warn(`[WARN] Không đọc được XML từ S3 (${inv.xml_file_key}): ${err.message}`);
      }
    }

    let lookupCode = inv.lookup_code;
    let targetProvider = inv.provider_code?.toUpperCase() || '';

    if (xmlContent) {
      const extracted = extractMetadataFromXml(xmlContent);
      if (extracted.providerGuess === 'HILO' && extracted.hiloKey) {
        targetProvider = 'HILO';
        lookupCode = extracted.hiloKey;
      } else if (extracted.providerGuess === 'MISA' && extracted.misaKey) {
        targetProvider = 'MISA';
        lookupCode = extracted.misaKey;
      } else if (extracted.providerGuess === 'CYBERBILL' && extracted.cyberbillKey) {
        targetProvider = 'CYBERBILL';
        lookupCode = extracted.cyberbillKey;
      }
    }

    // Nhận diện theo MST nếu chưa rõ
    if (!targetProvider || targetProvider === 'UNKNOWN') {
      if (inv.seller_tax_code === '0110269067') targetProvider = 'HILO';
      else if (inv.seller_tax_code === '0318656403') targetProvider = 'CYBERBILL';
    }

    console.log(`-> Provider: ${targetProvider || 'Chưa rõ'}, Mã tra cứu: ${lookupCode || 'Không có'}`);

    if (providerFilter !== 'ALL' && targetProvider !== providerFilter) {
      console.log(`[SKIP] Bỏ qua do lọc theo NCC: ${providerFilter}`);
      skipCount++;
      continue;
    }

    if (!lookupCode) {
      console.log(`[SKIP] Không có mã tra cứu để kết nối NCC.`);
      skipCount++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY-RUN] Sẽ gọi tải PDF cho provider ${targetProvider} với mã ${lookupCode}`);
      continue;
    }

    // 2. Tải PDF từ Adapter
    let pdfBuffer: Buffer | null = null;
    let errorMessage: string | null = null;

    try {
      if (targetProvider === 'HILO' || targetProvider === 'GSM') {
        const res = await hiloAdapter.downloadOriginalPdf({
          invoiceId: inv.id,
          invoiceNo: inv.invoice_no,
          serialNo: inv.serial_no,
          lookupCode,
          lookupUrl: inv.lookup_url,
          sellerTaxCode: inv.seller_tax_code,
          xmlContent: xmlContent || undefined,
        });
        if (res.success && res.pdfBuffer) pdfBuffer = res.pdfBuffer;
        else errorMessage = res.error || 'Lỗi không xác định từ HiloAdapter';
      } else if (targetProvider === 'MISA' || targetProvider === 'MEINVOICE') {
        const res = await misaAdapter.downloadOriginalPdf({
          invoiceId: inv.id,
          invoiceNo: inv.invoice_no,
          serialNo: inv.serial_no,
          lookupCode,
          lookupUrl: inv.lookup_url,
          sellerTaxCode: inv.seller_tax_code,
          xmlContent: xmlContent || undefined,
        });
        if (res.success && res.pdfBuffer) pdfBuffer = res.pdfBuffer;
        else errorMessage = res.error || 'Lỗi không xác định từ MisaAdapter';
      } else if (
        targetProvider === 'CYBERBILL' ||
        targetProvider === 'CYBERLOTUS' ||
        targetProvider === 'XCYBER'
      ) {
        const res = await cyberbillAdapter.downloadOriginalPdf({
          invoiceId: inv.id,
          invoiceNo: inv.invoice_no,
          serialNo: inv.serial_no,
          lookupCode,
          lookupUrl: inv.lookup_url,
          sellerTaxCode: inv.seller_tax_code,
          xmlContent: xmlContent || undefined,
        });
        if (res.success && res.pdfBuffer) pdfBuffer = res.pdfBuffer;
        else errorMessage = res.error || 'Lỗi không xác định từ CyberbillAdapter';
      } else {
        errorMessage = `Chưa có adapter hỗ trợ tải tự động cho NCC: ${targetProvider}`;
      }
    } catch (err: any) {
      errorMessage = err.message || 'Lỗi ngoại lệ khi gọi adapter';
    }

    // 3. Xử lý kết quả & Upload RustFS
    if (pdfBuffer && pdfBuffer.length > 500 && pdfBuffer.subarray(0, 4).toString() === '%PDF') {
      console.log(`[SUCCESS] Tải thành công PDF gốc: ${pdfBuffer.length} bytes`);
      const s3PdfKey = `invoices/pdf/${inv.id}.pdf`;

      // Upload S3 RustFS
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: s3PdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );
      console.log(`-> Đã upload RustFS: ${s3PdfKey}`);

      // Ghi erp_attachments
      const dateStr = inv.invoice_date ? new Date(inv.invoice_date).toISOString().slice(0, 10) : '2026-00-00';
      const safeSerial = (inv.serial_no || 'HD').replace(/[^\w-]/g, '_');
      const safeNo = (inv.invoice_no || '0').replace(/[^\w-]/g, '_');
      const fileName = `${dateStr}_${safeSerial}_${safeNo}.pdf`;

      const insertAttach = await ds.query(
        `INSERT INTO erp_attachments (file_name, file_key, file_size, mime_type, document_type, module)
         VALUES ($1, $2, $3, $4, 'HOA_DON', 'INVOICE')
         RETURNING id`,
        [fileName, s3PdfKey, pdfBuffer.length, 'application/pdf'],
      );
      const attachId = insertAttach[0].id;

      // Link erp_invoice_attachments
      await ds.query(
        `INSERT INTO erp_invoice_attachments (invoice_id, attachment_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [inv.id, attachId],
      );

      // Cập nhật erp_invoices
      await ds.query(
        `UPDATE erp_invoices
         SET pdf_file_key = $1, pdf_source = 'provider_original', pdf_error = NULL, updated_at = NOW()
         WHERE id = $2`,
        [s3PdfKey, inv.id],
      );
      console.log(`-> Đã lưu erp_attachments (#${attachId}) & cập nhật erp_invoices.`);
      successCount++;
    } else {
      console.warn(`[FAILED] Tải thất bại: ${errorMessage}`);
      await ds.query(
        `UPDATE erp_invoices
         SET pdf_error = $1, updated_at = NOW()
         WHERE id = $2`,
        [errorMessage || 'Không nhận được dữ liệu PDF hợp lệ', inv.id],
      );
      failCount++;
    }
  }

  await ds.destroy();

  console.log(`\n============================================================`);
  console.log(`TỔNG KẾT XỬ LÝ:`);
  console.log(`- Thành công: ${successCount}`);
  console.log(`- Thất bại:   ${failCount}`);
  console.log(`- Bỏ qua:     ${skipCount}`);
  console.log(`============================================================`);
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
