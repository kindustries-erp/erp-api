import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractKgaraClassification,
  mapKgaraClassificationToErp,
} from '../utils/kgara-parser.util';

// ── Environment resolution ──────────────────────────────────────────────────
const args = process.argv.slice(2);
let envFile = '.env.greenway-production';
const isApply = args.includes('--apply') || args.includes('-a');
const isDryRun = !isApply || args.includes('--dry-run');
const skipApiHydration = args.includes('--skip-api');

for (const arg of args) {
  if (
    !arg.startsWith('--') &&
    !arg.startsWith('-') &&
    fs.existsSync(path.resolve(process.cwd(), arg))
  ) {
    envFile = arg;
  }
}

const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
  console.log(`[Config] Loaded environment from: ${envFile}`);
} else {
  dotenv.config({ override: true });
  console.log(`[Config] Loaded default .env`);
}

async function getKgaraToken(
  ds: DataSource,
): Promise<{ token: string | null; host: string }> {
  const host = process.env.KGARA_API_HOST || 'api.kgara.com';

  // 1. Try DB valid token
  try {
    const auths = await ds.query(
      `SELECT access_token, refresh_token, token_expires 
       FROM kgara_auth 
       ORDER BY created_at DESC LIMIT 1`,
    );
    if (auths.length > 0) {
      const auth = auths[0];
      const expires = auth.token_expires ? new Date(auth.token_expires) : null;
      if (
        auth.access_token &&
        expires &&
        expires > new Date(Date.now() + 5 * 60 * 1000)
      ) {
        return { token: auth.access_token, host };
      }
    }
  } catch (err) {
    // ignore
  }

  // 2. Try login if credentials available
  const username = process.env.KGARA_USERNAME;
  const password = process.env.KGARA_PASSWORD;
  const makhachhang = process.env.KGARA_MA_KHACH_HANG;

  if (host && username && password && makhachhang) {
    try {
      console.log('🔄 Authenticating with KGara API...');
      const res = await fetch(`https://${host}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: username,
          Password: password,
          MaKhachHang: makhachhang,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data?.AccessToken) {
          await ds.query(
            `INSERT INTO kgara_auth (access_token, refresh_token, token_expires, ss_client_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [
              data.AccessToken,
              data.RefreshToken,
              data.TokenExpires ? new Date(data.TokenExpires) : null,
              data.SS_ClientID || '',
            ],
          );
          return { token: data.AccessToken, host };
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Failed to login to KGara API: ${err.message}`);
    }
  }

  return { token: process.env.KGARA_API_TOKEN || null, host };
}

async function run() {
  console.log(
    '===============================================================',
  );
  console.log('🚗 BACKFILL KGARA CLASSIFICATION SCRIPT');
  console.log(
    `Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '🔍 DRY-RUN (Preview only)'}`,
  );
  console.log(
    `API Hydration: ${skipApiHydration ? '⏭️ SKIPPED' : '🌐 ENABLED'}`,
  );
  console.log(
    '===============================================================\n',
  );

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();
  console.log('✅ Connected to PostgreSQL database.\n');

  try {
    // ── PASS 1: Extract from existing raw_data in DB ─────────────────────────
    console.log(
      '─── [PASS 1] Scanning existing raw_data in DB ─────────────────',
    );
    const casesWithRawData = await ds.query(
      `SELECT id, hd_phieu_dich_vu_id, so_chung_tu, bien_so_xe, classification, kgara_classification, kgara_classification_code, raw_data 
       FROM kgara_cases 
       WHERE raw_data IS NOT NULL`,
    );

    let pass1UpdatedCount = 0;
    let pass1ClassifiedCount = 0;

    for (const c of casesWithRawData) {
      const { kgaraClassification, kgaraClassificationCode } =
        extractKgaraClassification(c.raw_data);
      if (kgaraClassification || kgaraClassificationCode) {
        const autoMapped = mapKgaraClassificationToErp(
          kgaraClassificationCode,
          kgaraClassification,
        );
        const shouldSetClassification = !c.classification && autoMapped;

        if (
          c.kgara_classification !== kgaraClassification ||
          c.kgara_classification_code !== kgaraClassificationCode ||
          shouldSetClassification
        ) {
          pass1UpdatedCount++;
          if (shouldSetClassification) pass1ClassifiedCount++;

          if (isApply) {
            await ds.query(
              `UPDATE kgara_cases 
               SET kgara_classification = $1, 
                   kgara_classification_code = $2,
                   classification = COALESCE(classification, $3)
               WHERE id = $4`,
              [kgaraClassification, kgaraClassificationCode, autoMapped, c.id],
            );
          }
        }
      }
    }

    console.log(
      `[PASS 1 Result] Found ${casesWithRawData.length} cases with raw_data.`,
    );
    console.log(
      `  - Cases with KGara classification found: ${pass1UpdatedCount}`,
    );
    console.log(
      `  - Cases auto-mapped into ERP classification (from NULL): ${pass1ClassifiedCount}\n`,
    );

    // ── PASS 2: Incremental Detail Hydration via KGara API ───────────────────
    if (!skipApiHydration) {
      console.log(
        '─── [PASS 2] Fetching KGara Case Detail for remaining cases ────',
      );
      const unclassifiedCases = await ds.query(
        `SELECT id, hd_phieu_dich_vu_id, branch_external_id, so_chung_tu, bien_so_xe, classification, kgara_classification
         FROM kgara_cases 
         WHERE kgara_classification IS NULL 
           AND kgara_deleted_at IS NULL
         ORDER BY id ASC`,
      );

      console.log(
        `[PASS 2 Target] Found ${unclassifiedCases.length} cases needing detail hydration.`,
      );

      const { token: kgaraToken, host: kgaraHost } = await getKgaraToken(ds);

      if (!kgaraToken) {
        console.warn(
          '⚠️ No KGara token obtained. Skipping Pass 2 API hydration.',
        );
      } else {
        const CONCURRENCY = 5;
        let pass2SuccessCount = 0;
        let pass2FailedCount = 0;
        let pass2AutoMappedCount = 0;

        for (let i = 0; i < unclassifiedCases.length; i += CONCURRENCY) {
          const chunk = unclassifiedCases.slice(i, i + CONCURRENCY);
          await Promise.all(
            chunk.map(async (caseItem: any) => {
              try {
                const url = `https://${kgaraHost}/api/v1/gr/cases/detail?id=${encodeURIComponent(caseItem.hd_phieu_dich_vu_id)}`;
                const headers: Record<string, string> = {
                  Authorization: `Bearer ${kgaraToken}`,
                  'Content-Type': 'application/json',
                };
                if (caseItem.branch_external_id) {
                  headers['SS_ClientID'] = caseItem.branch_external_id;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const res = await fetch(url, {
                  headers,
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                  pass2FailedCount++;
                  return;
                }
                const resJson: any = await res.json();
                const detailData = resJson?.data || resJson;
                if (detailData) {
                  const { kgaraClassification, kgaraClassificationCode } =
                    extractKgaraClassification(detailData);
                  const autoMapped = mapKgaraClassificationToErp(
                    kgaraClassificationCode,
                    kgaraClassification,
                  );
                  const shouldSetClassification =
                    !caseItem.classification && autoMapped;

                  if (kgaraClassification || kgaraClassificationCode) {
                    pass2SuccessCount++;
                    if (shouldSetClassification) pass2AutoMappedCount++;

                    if (isApply) {
                      await ds.query(
                        `UPDATE kgara_cases 
                         SET kgara_classification = $1, 
                             kgara_classification_code = $2,
                             classification = COALESCE(classification, $3),
                             raw_data = $4
                         WHERE id = $5`,
                        [
                          kgaraClassification,
                          kgaraClassificationCode,
                          autoMapped,
                          detailData,
                          caseItem.id,
                        ],
                      );
                    }
                  }
                }
              } catch (err: any) {
                pass2FailedCount++;
              }
            }),
          );

          if (
            (i + CONCURRENCY) % 50 === 0 ||
            i + CONCURRENCY >= unclassifiedCases.length
          ) {
            console.log(
              `  [Progress] Processed ${Math.min(i + CONCURRENCY, unclassifiedCases.length)} / ${unclassifiedCases.length} cases...`,
            );
          }
        }

        console.log(`\n[PASS 2 Result] Detail Hydration Complete:`);
        console.log(
          `  - Successfully fetched and extracted: ${pass2SuccessCount}`,
        );
        console.log(
          `  - Newly auto-mapped into classification: ${pass2AutoMappedCount}`,
        );
        console.log(`  - API Errors / Not found: ${pass2FailedCount}\n`);
      }
    }

    // ── Summary Report ───────────────────────────────────────────────────────
    console.log(
      '─── Current Summary in Database ────────────────────────────────',
    );
    const stats = await ds.query(`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN kgara_classification IS NOT NULL THEN 1 END) as with_kgara_classification,
        COUNT(CASE WHEN classification IS NOT NULL THEN 1 END) as with_erp_classification,
        COUNT(CASE WHEN classification = 'OJ' THEN 1 END) as oj_count,
        COUNT(CASE WHEN classification = 'KY_GUI_NOI_BO' THEN 1 END) as ky_gui_count,
        COUNT(CASE WHEN classification = 'KHAC' THEN 1 END) as khac_count,
        COUNT(CASE WHEN classification = 'SUA_CHUA_CHUNG' THEN 1 END) as sua_chua_count
      FROM kgara_cases
    `);
    console.table(stats);
  } catch (error) {
    console.error('❌ Error during backfill:', error);
  } finally {
    await ds.destroy();
    console.log('DB connection closed.');
  }
}

run();
