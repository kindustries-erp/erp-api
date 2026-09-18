import { randomUUID } from 'crypto';
import { solveGdtSvgCaptcha } from './gdt-captcha-solver.helper';

export const GDT_PORTAL_BASE_URL = 'https://hoadondientu.gdt.gov.vn';
export const GDT_PORTAL_API_BASE_URL = 'https://hoadondientu.gdt.gov.vn/api';

export const GDT_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

export const GDT_BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': GDT_BROWSER_USER_AGENT,
  'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
  'sec-ch-ua':
    '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

/**
 * In-memory Cookie Jar for managing GDT session & WAF cookies (TS0114b13e, df9a..., JSESSIONID, e1a5...)
 */
export class GdtCookieJar {
  private cookies = new Map<string, string>();

  constructor(initialCookies?: string) {
    if (initialCookies) {
      this.parseAndSave(initialCookies);
    }
  }

  public parseAndSave(
    setCookieHeader: string | string[] | null | undefined,
  ): void {
    if (!setCookieHeader) return;

    // Handle array or comma-separated Set-Cookie (where commas don't appear in dates)
    const rawItems: string[] = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === 'string' &&
          setCookieHeader.includes(';') &&
          !setCookieHeader.includes(',')
        ? setCookieHeader.split(';')
        : setCookieHeader.split(/,(?=[^;]+=[^;]+)/);

    for (const rawItem of rawItems) {
      const parts = rawItem.split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const equalIdx = trimmed.indexOf('=');
        if (equalIdx <= 0) continue;

        const name = trimmed.substring(0, equalIdx).trim();
        const value = trimmed.substring(equalIdx + 1).trim();

        const lower = name.toLowerCase();
        if (
          [
            'path',
            'domain',
            'expires',
            'max-age',
            'samesite',
            'httponly',
            'secure',
          ].includes(lower)
        ) {
          continue;
        }

        this.cookies.set(name, value);
      }
    }
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  public set(name: string, value: string): void {
    this.cookies.set(name.trim(), value.trim());
  }

  public get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public has(name: string): boolean {
    return this.cookies.has(name);
  }

  public clear(): void {
    this.cookies.clear();
  }

  public size(): number {
    return this.cookies.size;
  }
}

/**
 * Initialize a fresh session from GDT Homepage to acquire WAF and Session cookies.
 */
export async function initGdtSession(
  jar?: GdtCookieJar,
): Promise<GdtCookieJar> {
  const cookieJar = jar ?? new GdtCookieJar();

  try {
    const res = await fetch(`${GDT_PORTAL_BASE_URL}/`, {
      method: 'GET',
      headers: {
        ...GDT_BROWSER_HEADERS,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
    });

    cookieJar.parseAndSave(res.headers.get('set-cookie'));
  } catch {
    // If homepage fails (e.g. transient network), proceed with existing jar
  }

  return cookieJar;
}

/**
 * Fetch Captcha SVG and key from GDT using session cookies.
 */
export async function fetchGdtCaptchaWithSession(
  jar?: GdtCookieJar,
): Promise<{ content: string; key: string; text: string; jar: GdtCookieJar }> {
  let cookieJar = jar;
  if (!cookieJar || cookieJar.size() === 0) {
    cookieJar = await initGdtSession(cookieJar);
  }

  const cookieHeader = cookieJar.getCookieHeader();
  const res = await fetch(`${GDT_PORTAL_API_BASE_URL}/captcha`, {
    method: 'GET',
    headers: {
      ...GDT_BROWSER_HEADERS,
      Accept: 'application/json, text/plain, */*',
      Referer: `${GDT_PORTAL_BASE_URL}/`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(
      `Không thể tải mã Captcha từ Cổng thuế (HTTP ${res.status})`,
    );
  }

  cookieJar.parseAndSave(res.headers.get('set-cookie'));

  const data = (await res.json()) as { key?: string; content?: string };
  if (!data?.key || !data?.content) {
    throw new Error('Phản hồi Captcha từ Cổng thuế không hợp lệ');
  }

  const text = solveGdtSvgCaptcha(data.content);

  return {
    content: data.content,
    key: data.key,
    text,
    jar: cookieJar,
  };
}

/**
 * Authenticate with GDT Portal using solved captcha, credentials, request-id, and session cookies.
 */
export async function authenticateGdtWithSession(dto: {
  username: string;
  password?: string;
  cvalue: string;
  ckey: string;
  jar?: GdtCookieJar;
}): Promise<{ token: string; cookies: string }> {
  const { username, password, cvalue, ckey } = dto;
  const cookieJar = dto.jar ?? new GdtCookieJar();
  const cookieHeader = cookieJar.getCookieHeader();

  const requestId = randomUUID();
  const url = `${GDT_PORTAL_API_BASE_URL}/security-taxpayer/authenticate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...GDT_BROWSER_HEADERS,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      Origin: GDT_PORTAL_BASE_URL,
      Referer: `${GDT_PORTAL_BASE_URL}/`,
      'End-Point': '/',
      Action: '',
      'request-id': requestId,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({
      username,
      password: password || '',
      cvalue,
      ckey,
    }),
  });

  cookieJar.parseAndSave(res.headers.get('set-cookie'));

  if (!res.ok) {
    let errMessage = 'Đăng nhập thất bại';
    try {
      const errData = await res.json();
      errMessage =
        errData?.message ||
        errData?.error ||
        errData?.description ||
        `Đăng nhập thất bại (HTTP ${res.status})`;
    } catch {
      errMessage = `Đăng nhập thất bại (HTTP ${res.status})`;
    }

    const err = new Error(errMessage) as any;
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as any;
  const token =
    data?.token ||
    data?.appToken ||
    data?.accessToken ||
    data?.jwt ||
    data?.data?.token ||
    (typeof data === 'string' ? data : '');

  if (!token) {
    throw new Error('Không tìm thấy token trong phản hồi từ Cổng thuế');
  }

  return {
    token,
    cookies: cookieJar.getCookieHeader(),
  };
}
