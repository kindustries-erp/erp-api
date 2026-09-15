import { Client } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import AdmZip from 'adm-zip';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://erp_greenway_production_admin:Cg4b6wqHAH3kWVP2pbCismcari9Tz-4ueB4YH_Pd@db.liouni.com:5432/erp_greenway_production?sslmode=disable';
  const client = new Client({ connectionString });
  await client.connect();

  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.R2_ENDPOINT || 'https://s3.liouni.com/',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || 'nD3H4OwR0K3FWLAbaUi0',
      secretAccessKey:
        process.env.R2_SECRET_ACCESS_KEY ||
        '5pQUBP1xzZbl5Tr6gJuOrG8PLvRMgcp3HOqx0QFS',
    },
    forcePathStyle: true,
  });

  const bucketName = process.env.R2_BUCKET_NAME || 'erp-greenway-production';

  console.log(
    'Fetching invoices with tax_invoice_status in (2, 3) or having XML...',
  );
  const res = await client.query(`
    SELECT id, invoice_no, serial_no, direction, tax_invoice_status, xml_file_key, description, notes, related_invoice_no, related_serial_no
    FROM erp_invoices 
    WHERE is_deleted = false AND (tax_invoice_status IN (2, 3) OR xml_file_key IS NOT NULL)
    ORDER BY invoice_date DESC;
  `);

  console.log(`Found ${res.rows.length} candidate invoices.`);
  let updatedCount = 0;

  for (const row of res.rows) {
    let relatedNo: string | null = row.related_invoice_no;
    let relatedSerial: string | null = row.related_serial_no;

    // 1. Try reading from XML if available and not yet set
    if (!relatedNo && row.xml_file_key) {
      try {
        const cmd = new GetObjectCommand({
          Bucket: bucketName,
          Key: row.xml_file_key,
        });
        const s3Res = await s3.send(cmd);
        const buffer = Buffer.from(await s3Res.Body!.transformToByteArray());
        let xmlContent = '';
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
        console.warn(`[S3 WARN] ${row.invoice_no}: ${err.message}`);
      }
    }

    // 2. Fallback: parse description text if still missing
    if (
      !relatedNo &&
      (row.tax_invoice_status === 2 || row.tax_invoice_status === 3)
    ) {
      const textToScan = [row.description, row.notes].filter(Boolean).join(' ');
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

    // 3. Update DB if relatedNo was found
    if (
      relatedNo &&
      (relatedNo !== row.related_invoice_no ||
        relatedSerial !== row.related_serial_no)
    ) {
      // Normalize leading zeros if needed or keep raw
      await client.query(
        `UPDATE erp_invoices 
         SET related_invoice_no = $1, related_serial_no = $2, updated_at = NOW() 
         WHERE id = $3`,
        [relatedNo, relatedSerial, row.id],
      );
      updatedCount++;
      console.log(
        `[UPDATED] Invoice ${row.invoice_no} (${row.serial_no}) -> Related: No=${relatedNo}, Serial=${relatedSerial}`,
      );

      // Also mark the original invoice if found
      const targetStatus = row.tax_invoice_status === 3 ? 5 : 4;
      await client.query(
        `UPDATE erp_invoices
         SET tax_invoice_status = $1, updated_at = NOW()
         WHERE invoice_no = $2 AND ($3::text IS NULL OR serial_no = $3) AND direction = $4 AND is_deleted = false AND (tax_invoice_status IS NULL OR tax_invoice_status = 1)`,
        [targetStatus, relatedNo, relatedSerial, row.direction],
      );
    }
  }

  console.log(`\n=== BACKFILL COMPLETE: Updated ${updatedCount} invoices ===`);
  await client.end();
}

main().catch(console.error);
