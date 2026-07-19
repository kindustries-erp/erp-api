import { Logger } from '@nestjs/common';

const gdtLogger = new Logger('InvoiceGdtHelper');

/**
 * Sleep helper — reusable across portal/import flows.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetchWithRetry — wraps native fetch with timeout, GDT-compatible UA headers,
 * automatic retry on 429/5xx, and throws on 401/403 (token expired).
 */
export async function fetchWithRetry(
  url: string | URL,
  options?: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://hoadondientu.gdt.gov.vn/tra-cuu/tra-cuu-hoa-don',
          'sec-ch-ua':
            '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          ...(options?.headers || {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) return res;

      if (res.status === 401 || res.status === 403) {
        throw new Error('GDT_TOKEN_EXPIRED');
      }

      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (i < retries) {
          gdtLogger.warn(
            `GDT API rate limit or server error (${res.status}) on ${url}, retrying ${i + 1}/${retries}...`,
          );
          const delay = res.status === 429 ? 5000 * (i + 1) : 1000 * (i + 1);
          await sleep(delay);
          continue;
        }
      }

      return res;
    } catch (err: any) {
      if (i < retries) {
        gdtLogger.warn(
          `GDT API fetch failed (${err.name}: ${err.message}) on ${url}, retrying ${i + 1}/${retries}...`,
        );
        await sleep(1000 * (i + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable code');
}

/**
 * Resolve VAT rate from raw portal payload.
 * Returns a decimal string ("0.08" for 8%) or null.
 */
export function resolvePortalVatRate(raw: any): string | null {
  if (Array.isArray(raw.thttltsuat) && raw.thttltsuat.length > 0) {
    const rateStr = String(raw.thttltsuat[0]?.tsuat ?? '');
    const match = rateStr.match(/([\d.]+)/);
    if (match) return String(Number(match[1]) / 100);
  }
  if (raw.tsuattue != null) {
    const n = Number(raw.tsuattue);
    return Number.isFinite(n) ? String(n / 100) : null;
  }
  return null;
}

/**
 * Convert GDT ISO date string (UTC) to YYYY-MM-DD in GMT+7.
 */
export function parsePortalIsoDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate.slice(0, 10);
    const tzDate = new Date(date.getTime() + 7 * 3600 * 1000);
    return tzDate.toISOString().slice(0, 10);
  } catch {
    return isoDate.slice(0, 10);
  }
}

/**
 * Build a safe R2 storage key for an invoice file.
 * Pattern: invoices/{direction}/{yyyy}/{mm}/{dateStr}_{safeTax}_{safeSerial}_{safeNo}.{ext}
 */
export function buildInvoiceR2Key(params: {
  direction: string;
  invoiceDate?: string | null;
  taxCode?: string | null;
  serialNo?: string | null;
  invoiceNo: string;
  ext: string;
}): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const dateStr = params.invoiceDate || `${yyyy}-${mm}-01`;
  const safeTax = (params.taxCode ?? 'unknown').replace(/[^\w]/g, '');
  const safeSerial = (params.serialNo ?? 'unknown').replace(/[^\w-]/g, '_');
  const safeNo = params.invoiceNo.replace(/[^\w-]/g, '_');

  return `invoices/${params.direction}/${yyyy}/${mm}/${dateStr}_${safeTax}_${safeSerial}_${safeNo}.${params.ext}`;
}

/**
 * Extract XML string from a buffer that may be plain XML or a ZIP containing XML.
 * Returns empty string if no XML found.
 */
export function extractXmlFromBuffer(buffer: Buffer): {
  xmlString: string;
  isZip: boolean;
} {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (!isZip) {
    return { xmlString: buffer.toString('utf8'), isZip: false };
  }

  // Dynamic import to avoid top-level side effects
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const xmlEntry = zipEntries.find((e: any) =>
    e.entryName.toLowerCase().endsWith('.xml'),
  );
  return {
    xmlString: xmlEntry ? xmlEntry.getData().toString('utf8') : '',
    isZip: true,
  };
}
