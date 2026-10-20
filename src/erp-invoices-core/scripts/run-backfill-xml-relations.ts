import { Client } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

// Load .env candidates (support argument or .env)
const targetEnvFile = process.argv[2] || '.env';

const envPath = path.isAbsolute(targetEnvFile)
  ? targetEnvFile
  : path.resolve(process.cwd(), targetEnvFile);

console.log(`Loading env configuration from: ${envPath}`);
const envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      envVars[k] = v;
    }
  }
}

const connectionString: string =
  envVars.DATABASE_URL || process.env.DATABASE_URL || '';
if (!connectionString) {
  throw new Error(
    '❌ DATABASE_URL is not defined in environment variables or .env file',
  );
}

const bucketName = envVars.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || '';
if (!bucketName) {
  throw new Error(
    '❌ R2_BUCKET_NAME is not defined in environment variables or .env file',
  );
}

const s3Endpoint = envVars.R2_ENDPOINT || process.env.R2_ENDPOINT || undefined;

const s3AccessKey =
  envVars.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';

const s3SecretKey =
  envVars.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';

if (!s3AccessKey || !s3SecretKey) {
  throw new Error(
    '❌ R2 credentials (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) not found in env',
  );
}

console.log('Connecting to DB:', connectionString.replace(/:[^:@]+@/, ':***@'));
console.log('Using S3 Bucket:', bucketName);

export function parseInfoDiffs(text: string) {
  const diffs: Array<{
    field: string;
    fieldNameVi: string;
    oldValue: string;
    newValue: string;
  }> = [];

  const effectiveValues: Record<string, string> = {};

  // 1. Mã số thuế
  const mstMatch = text.match(/Mã số thuế:\s*([^\s->]+)\s*->\s*([^\s->]+)/i);
  if (mstMatch) {
    diffs.push({
      field: 'buyerTaxCode',
      fieldNameVi: 'Mã số thuế',
      oldValue: mstMatch[1].trim(),
      newValue: mstMatch[2].trim(),
    });
    effectiveValues.buyerTaxCode = mstMatch[2].trim();
  }

  // 2. Tên đơn vị / người mua
  const nameMatch = text.match(
    /Tên đơn vị:\s*([^->]+?)\s*->\s*([^->\n]+?)(?:-[A-ZÀ-Ỹ]|$)/i,
  );
  if (nameMatch) {
    diffs.push({
      field: 'buyerName',
      fieldNameVi: 'Tên đơn vị',
      oldValue: nameMatch[1].trim(),
      newValue: nameMatch[2].trim(),
    });
    effectiveValues.buyerName = nameMatch[2].trim();
  }

  // 3. Địa chỉ
  const addrMatch = text.match(
    /Địa chỉ:\s*([^->]+?)\s*->\s*([^->\n]+?)(?:-[A-ZÀ-Ỹ]|$)/i,
  );
  if (addrMatch) {
    diffs.push({
      field: 'buyerAddress',
      fieldNameVi: 'Địa chỉ',
      oldValue: addrMatch[1].trim(),
      newValue: addrMatch[2].trim(),
    });
    effectiveValues.buyerAddress = addrMatch[2].trim();
  }

  // 4. Số CCCD
  const cccdMatch = text.match(
    /(?:Số giấy tờ|CCCD):\s*(?:->)?\s*([0-9]{9,12})/i,
  );
  if (cccdMatch) {
    diffs.push({
      field: 'buyerCccd',
      fieldNameVi: 'Số CCCD',
      oldValue: '',
      newValue: cccdMatch[1].trim(),
    });
    effectiveValues.buyerCccd = cccdMatch[1].trim();
  }

  // 5. Biển số xe (BKS)
  const plateMatch = text.match(/BKS\s*([0-9]{2}[A-Z0-9]+)/i);
  if (plateMatch) {
    effectiveValues.licensePlate = plateMatch[1].trim();
  }

  // 6. Số quyết toán WO
  const woMatch = text.match(/QT\s*([A-Z0-9-]+)/i);
  if (woMatch) {
    effectiveValues.settlementOrder = woMatch[1].trim();
  }

  return { diffs, effectiveValues };
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: s3Endpoint,
    credentials: {
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
    },
    forcePathStyle: true,
  });

  const res = await client.query(`
    SELECT id, invoice_no, serial_no, direction, total_amount, tax_invoice_status, 
           xml_file_key, description, notes, related_invoice_no, related_serial_no, invoice_date
    FROM erp_invoices 
    WHERE is_deleted = false 
      AND (tax_invoice_status IN (2, 3) OR (description ILIKE '%điều chỉnh%' AND total_amount = 0))
    ORDER BY invoice_date DESC;
  `);

  console.log(`Checking ${res.rows.length} candidate adjustment invoices...`);
  let updatedRelationCount = 0;
  let netoffCreatedCount = 0;
  let effectiveDataCount = 0;

  for (const row of res.rows) {
    let relatedNo: string | null = row.related_invoice_no;
    let relatedSerial: string | null = row.related_serial_no;
    let xmlContent = '';

    // 1. Try reading from XML if available
    if (row.xml_file_key) {
      try {
        const cmd = new GetObjectCommand({
          Bucket: bucketName,
          Key: row.xml_file_key,
        });
        const s3Res = await s3.send(cmd);
        const buffer = Buffer.from(await s3Res.Body!.transformToByteArray());
        if (row.xml_file_key.endsWith('.zip')) {
          const zip = new AdmZip(buffer);
          const xmlEntry = zip
            .getEntries()
            .find((e) => e.entryName.endsWith('.xml'));
          if (xmlEntry) xmlContent = xmlEntry.getData().toString('utf8');
        } else if (row.xml_file_key.endsWith('.xml')) {
          xmlContent = buffer.toString('utf8');
        }

        if (xmlContent) {
          const shdMatch =
            xmlContent.match(/<SHDCLQuan>([^<]+)<\/SHDCLQuan>/i) ||
            xmlContent.match(/<SHDGoc>([^<]+)<\/SHDGoc>/i) ||
            xmlContent.match(/<SoHoaDonGoc>([^<]+)<\/SoHoaDonGoc>/i) ||
            xmlContent.match(
              /<OriginalInvoiceNo>([^<]+)<\/OriginalInvoiceNo>/i,
            );
          const khdMatch =
            xmlContent.match(/<KHHDCLQuan>([^<]+)<\/KHHDCLQuan>/i) ||
            xmlContent.match(/<KHHDGoc>([^<]+)<\/KHHDGoc>/i) ||
            xmlContent.match(/<KHHDonGoc>([^<]+)<\/KHHDonGoc>/i) ||
            xmlContent.match(/<KyHieuGoc>([^<]+)<\/KyHieuGoc>/i) ||
            xmlContent.match(
              /<OriginalInvoiceSerial>([^<]+)<\/OriginalInvoiceSerial>/i,
            );
          const gchuMatch = xmlContent.match(/<GChu>([^<]+)<\/GChu>/i);

          if (shdMatch) {
            relatedNo = shdMatch[1].trim();
            if (khdMatch) relatedSerial = khdMatch[1].trim();
          } else if (gchuMatch) {
            const gchu = gchuMatch[1];
            const m1 = gchu.match(
              /(?:điều chỉnh|thay thế).*?ký hiệu\s*([A-Z0-9]+).*?số\s*([0-9]+)/i,
            );
            if (m1) {
              relatedSerial = m1[1].trim();
              relatedNo = m1[2].trim();
            }
          }
        }
      } catch (err: any) {
        // ignore
      }
    }

    // 2. Fallback: parse description text or items
    if (!relatedNo) {
      const itemsRes = await client.query(
        'SELECT description FROM erp_invoice_items WHERE invoice_id = $1',
        [row.id],
      );
      const textToScan = [
        row.description,
        row.notes,
        ...itemsRes.rows.map((it) => it.description),
      ]
        .filter(Boolean)
        .join(' ');

      const m1 = textToScan.match(
        /(?:điều chỉnh|thay thế).*?ký hiệu\s*([A-Z0-9]+).*?số\s*([0-9]+)/i,
      );
      if (m1) {
        relatedSerial = m1[1].trim();
        relatedNo = m1[2].trim();
      } else {
        const m2 = textToScan.match(
          /(?:điều chỉnh|thay thế).*?số\s*([0-9]+).*?ký hiệu\s*([A-Z0-9]+)/i,
        );
        if (m2) {
          relatedNo = m2[1].trim();
          relatedSerial = m2[2].trim();
        }
      }
    }

    if (relatedNo) {
      // Chuẩn hóa số không vô nghĩa
      const normRelatedNo = String(parseInt(relatedNo, 10));

      await client.query(
        `UPDATE erp_invoices 
         SET related_invoice_no = $1, related_serial_no = $2, updated_at = NOW() 
         WHERE id = $3`,
        [normRelatedNo, relatedSerial, row.id],
      );
      updatedRelationCount++;

      // Tìm HĐ gốc tương ứng
      const origRes = await client.query(
        `SELECT id, invoice_no, serial_no, total_amount, buyer_tax_code, buyer_name
         FROM erp_invoices 
         WHERE (invoice_no = $1 OR invoice_no = $2)
           AND ($3::text IS NULL OR serial_no = $3)
           AND direction = $4 AND is_deleted = false
         LIMIT 1`,
        [relatedNo, normRelatedNo, relatedSerial, row.direction],
      );

      if (origRes.rows.length > 0) {
        const orig = origRes.rows[0];
        const targetStatus = row.tax_invoice_status === 3 ? 5 : 4;

        // Cập nhật trạng thái HĐ gốc: 5 (bị điều chỉnh) hoặc 4 (bị thay thế)
        await client.query(
          `UPDATE erp_invoices
           SET tax_invoice_status = $1, updated_at = NOW()
           WHERE id = $2`,
          [targetStatus, orig.id],
        );

        // Bóc tách Diff thông tin và lưu effective_data
        const fullScanText = [row.description, row.notes, xmlContent]
          .filter(Boolean)
          .join(' ');
        const { diffs, effectiveValues } = parseInfoDiffs(fullScanText);

        if (diffs.length > 0 || Object.keys(effectiveValues).length > 0) {
          const effectiveData = {
            isAdjusted: true,
            adjustingInvoiceId: row.id,
            adjustingInvoiceNo: row.invoice_no,
            adjustingSerialNo: row.serial_no,
            adjustedAt: row.invoice_date,
            effectiveValues,
            diffLog: diffs,
          };

          await client.query(
            `UPDATE erp_invoices
             SET effective_data = $1, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(effectiveData), orig.id],
          );
          effectiveDataCount++;
        }

        // Nếu là HĐ điều chỉnh giảm tiền (total_amount < 0)
        const adjAmount = Number(row.total_amount);
        const origTotal = Number(orig.total_amount);

        if (row.tax_invoice_status === 3 && adjAmount < 0 && origTotal > 0) {
          const offsetAmount = Math.min(Math.abs(adjAmount), origTotal);
          const offsetType =
            Math.abs(adjAmount) >= origTotal
              ? 'FULL_CANCELLATION'
              : 'REDUCTION';

          await client.query(
            `INSERT INTO erp_invoice_adjustment_netoff (
               id, original_invoice_id, adjusting_invoice_id, offset_amount, offset_type, notes, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()
             )
             ON CONFLICT (original_invoice_id, adjusting_invoice_id) 
             DO UPDATE SET offset_amount = EXCLUDED.offset_amount, updated_at = NOW()`,
            [
              orig.id,
              row.id,
              offsetAmount,
              offsetType,
              `Cấn trừ tự động theo HĐ ĐC ${row.invoice_no}`,
            ],
          );
          netoffCreatedCount++;
          console.log(
            `  💸 [NET-OFF] HĐ ĐC ${row.invoice_no} (${adjAmount.toLocaleString()}đ) cấn trừ ${offsetAmount.toLocaleString()}đ vào HĐ Gốc ${orig.invoice_no} (${origTotal.toLocaleString()}đ) -> Dư nợ HĐ gốc còn ${(origTotal - offsetAmount).toLocaleString()}đ`,
          );
        }
      }
    }
  }

  console.log(`\n========================================================`);
  console.log(`✅ HOÀN TẤT BACKFILL DỮ LIỆU ĐIỀU CHỈNH:`);
  console.log(
    `- Đã cập nhật liên kết related_invoice_no: ${updatedRelationCount} HĐ`,
  );
  console.log(
    `- Đã tạo bản ghi cấn trừ công nợ tự động: ${netoffCreatedCount} cặp HĐ`,
  );
  console.log(
    `- Đã bóc tách dữ liệu hiệu lực effective_data: ${effectiveDataCount} HĐ`,
  );
  console.log(`========================================================\n`);

  await client.end();
}

main().catch(console.error);
