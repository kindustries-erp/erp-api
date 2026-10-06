import { Client } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

// 1. Load env configuration
const targetEnvFile =
  process.argv[2] ||
  (fs.existsSync(path.resolve(process.cwd(), '.env.greenway-production'))
    ? '.env.greenway-production'
    : '.env');

const envPath = path.isAbsolute(targetEnvFile)
  ? targetEnvFile
  : path.resolve(process.cwd(), targetEnvFile);

console.log(`[Backfill] Loading environment from: ${envPath}`);
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

const connectionString =
  envVars.DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://erp_greenway_production_admin:Cg4b6wqHAH3kWVP2pbCismcari9Tz-4ueB4YH_Pd@db-dev.liouni.com:5433/erp_greenway_production?sslmode=disable';

const bucketName =
  envVars.R2_BUCKET_NAME ||
  process.env.R2_BUCKET_NAME ||
  'erp-greenway-production';

const s3Endpoint =
  envVars.R2_ENDPOINT || process.env.R2_ENDPOINT || 'https://s3.liouni.com/';

const s3AccessKey =
  envVars.R2_ACCESS_KEY_ID ||
  process.env.R2_ACCESS_KEY_ID ||
  'nD3H4OwR0K3FWLAbaUi0';

const s3SecretKey =
  envVars.R2_SECRET_ACCESS_KEY ||
  process.env.R2_SECRET_ACCESS_KEY ||
  '5pQUBP1xzZbl5Tr6gJuOrG8PLvRMgcp3HOqx0QFS';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: s3Endpoint,
  credentials: {
    accessKeyId: s3AccessKey,
    secretAccessKey: s3SecretKey,
  },
  forcePathStyle: true,
});

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function extractBuyerInfoFromXml(xmlText: string): {
  buyerPersonalName?: string;
  buyerCccd?: string;
  buyerPhone?: string;
} {
  const nmuaMatch = xmlText.match(/<NMua[\s\S]*?<\/NMua>/i);
  const nmuaBlock = nmuaMatch ? nmuaMatch[0] : xmlText;

  // Trích xuất họ tên người mua
  const namePatterns = [
    /<HVTNMHang[^>]*>([^<]+)<\/HVTNMHang>/i,
    /<hvtnmhang[^>]*>([^<]+)<\/hvtnmhang>/i,
    /<HoTen[^>]*>([^<]+)<\/HoTen>/i,
    /<hoten[^>]*>([^<]+)<\/hoten>/i,
    /<TenNMua[^>]*>([^<]+)<\/TenNMua>/i,
    /<TNNMua[^>]*>([^<]+)<\/TNNMua>/i,
    /<NMuaHVTNMHang[^>]*>([^<]+)<\/NMuaHVTNMHang>/i,
  ];

  let buyerPersonalName: string | undefined;
  for (const pat of namePatterns) {
    const match = nmuaBlock.match(pat);
    if (match && match[1]?.trim()) {
      buyerPersonalName = match[1].trim();
      break;
    }
  }

  // Trích xuất CCCD / CMND
  const cccdPatterns = [
    /<CCCD[^>]*>([^<]+)<\/CCCD>/i,
    /<CMND[^>]*>([^<]+)<\/CMND>/i,
    /<SoGiayTo[^>]*>([^<]+)<\/SoGiayTo>/i,
  ];

  let buyerCccd: string | undefined;
  for (const pat of cccdPatterns) {
    const match = nmuaBlock.match(pat);
    if (match && match[1]?.trim()) {
      buyerCccd = match[1].trim();
      break;
    }
  }

  // Trích xuất SĐT
  const phonePatterns = [
    /<SDThoai[^>]*>([^<]+)<\/SDThoai>/i,
    /<DThoai[^>]*>([^<]+)<\/DThoai>/i,
  ];

  let buyerPhone: string | undefined;
  for (const pat of phonePatterns) {
    const match = nmuaBlock.match(pat);
    if (match && match[1]?.trim()) {
      buyerPhone = match[1].trim();
      break;
    }
  }

  return { buyerPersonalName, buyerCccd, buyerPhone };
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('[Backfill] Connected to PostgreSQL successfully.');

  try {
    const query = `
      SELECT id, invoice_no, serial_no, invoice_date, xml_file_key
      FROM erp_invoices
      WHERE direction = 'OUT'
        AND (buyer_name IS NULL OR TRIM(buyer_name) = '')
        AND (buyer_personal_name IS NULL OR TRIM(buyer_personal_name) = '')
        AND xml_file_key IS NOT NULL
      ORDER BY invoice_date ASC, invoice_no ASC;
    `;

    const res = await client.query(query);
    console.log(
      `[Backfill] Found ${res.rowCount} candidate invoices to backfill.`,
    );

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of res.rows) {
      const { id, invoice_no, serial_no, xml_file_key } = row;
      try {
        const s3res = await s3.send(
          new GetObjectCommand({
            Bucket: bucketName,
            Key: xml_file_key,
          }),
        );

        const zipBuffer = await streamToBuffer(s3res.Body);
        const zip = new AdmZip(zipBuffer);
        const zipEntries = zip.getEntries();

        let xmlContent: string | null = null;
        for (const entry of zipEntries) {
          if (entry.entryName.toLowerCase().endsWith('.xml')) {
            xmlContent = entry.getData().toString('utf8');
            break;
          }
        }

        if (!xmlContent) {
          console.warn(
            `[Backfill] No XML file in zip for HĐ ${invoice_no} (${xml_file_key})`,
          );
          skippedCount++;
          continue;
        }

        const { buyerPersonalName, buyerCccd } =
          extractBuyerInfoFromXml(xmlContent);

        if (!buyerPersonalName && !buyerCccd) {
          console.warn(
            `[Backfill] No personal buyer name/CCCD found in XML for HĐ ${invoice_no}`,
          );
          skippedCount++;
          continue;
        }

        await client.query(
          `
            UPDATE erp_invoices
            SET buyer_personal_name = COALESCE($1, buyer_personal_name),
                buyer_cccd = COALESCE($2, buyer_cccd),
                updated_at = NOW()
            WHERE id = $3;
          `,
          [buyerPersonalName || null, buyerCccd || null, id],
        );

        updatedCount++;
        console.log(
          `[Backfill] [${updatedCount}/${res.rowCount}] Updated HĐ ${invoice_no} (${serial_no}): ` +
            `buyer_personal_name='${buyerPersonalName || ''}'` +
            (buyerCccd ? `, buyer_cccd='${buyerCccd}'` : ''),
        );
      } catch (err: any) {
        errorCount++;
        console.error(
          `[Backfill] Error processing HĐ ${invoice_no}:`,
          err.message,
        );
      }
    }

    console.log('\n========================================');
    console.log(`[Backfill] SUMMARY:`);
    console.log(`  - Total candidate invoices: ${res.rowCount}`);
    console.log(`  - Successfully updated:     ${updatedCount}`);
    console.log(`  - Skipped (no name in XML): ${skippedCount}`);
    console.log(`  - Errors:                   ${errorCount}`);
    console.log('========================================\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
