import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KgaraAuthService } from './kgara-auth.service';
import { KgaraAccountKey } from './enums/kgara-account.enum';

/** Số lần thử lại tối đa khi KGara (SQL Server) chọn request làm nạn nhân deadlock. */
export const KGARA_DEADLOCK_MAX_RETRIES = 3;
const KGARA_DEADLOCK_BASE_DELAY_MS = 500;

/**
 * KGara trả HTTP 200 nhưng body `status: 500` kèm thông báo "deadlocked ... Rerun the transaction"
 * khi nhiều request chạy song song. Lỗi này tạm thời và thử lại là thành công.
 */
export function isKgaraDeadlockBody(body: any): boolean {
  return body?.status === 500 && /deadlock/i.test(String(body?.message ?? ''));
}

@Injectable()
export class KgaraClientService {
  private readonly logger = new Logger(KgaraClientService.name);

  constructor(
    private authService: KgaraAuthService,
    private configService: ConfigService,
  ) {}

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async request(
    endpoint: string,
    options: RequestInit = {},
    branchId?: string,
    isRetry = false,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
    deadlockAttempt = 0,
  ): Promise<any> {
    const token = await this.authService.getValidToken(accountKey);
    if (!token) {
      const reason = this.authService.getLastError(accountKey);
      throw new Error(
        `Could not obtain Kgara token for account ${accountKey}${reason ? `: ${reason}` : ''}`,
      );
    }

    const creds = this.authService.getCredentials(accountKey);
    const host =
      creds?.host || this.configService.get<string>('KGARA_API_HOST');
    const url = `https://${host}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    // Only add Content-Type for POST/PUT/PATCH
    if (options.method && options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    if (branchId) {
      headers['SS_ClientID'] = branchId;
    }

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      if (response.status === 401 && !isRetry) {
        this.logger.warn(
          `Received 401 Unauthorized for account ${accountKey}, refreshing token and retrying...`,
        );
        await this.authService.forceRefreshToken(accountKey);
        return this.request(endpoint, options, branchId, true, accountKey); // Retry once
      }

      // Parse business error from JSON if available
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch (e) {
        // body is not JSON (e.g. some 401/500 responses)
      }
      const message = errorBody?.message || response.statusText;
      throw new Error(`Kgara API Error: ${response.status} ${message}`);
    }

    const body = await response.json();
    // Chỉ thử lại request đọc (GET): ghi lại có thể lặp tác dụng phụ nếu KGara đã commit một phần
    const isRead = !options.method || options.method.toUpperCase() === 'GET';
    if (isRead && isKgaraDeadlockBody(body)) {
      if (deadlockAttempt >= KGARA_DEADLOCK_MAX_RETRIES) {
        throw new Error(
          `Kgara API Error: deadlock sau ${KGARA_DEADLOCK_MAX_RETRIES} lần thử lại (${endpoint}): ${body.message}`,
        );
      }
      const delay =
        KGARA_DEADLOCK_BASE_DELAY_MS * 2 ** deadlockAttempt +
        Math.floor(Math.random() * 250);
      this.logger.warn(
        `Kgara deadlock (${endpoint}), thử lại lần ${deadlockAttempt + 1}/${KGARA_DEADLOCK_MAX_RETRIES} sau ${delay}ms`,
      );
      await this.sleep(delay);
      return this.request(
        endpoint,
        options,
        branchId,
        isRetry,
        accountKey,
        deadlockAttempt + 1,
      );
    }
    return body;
  }

  async getBranches(
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any[]> {
    return this.request('/api/v1/donvi/list', {}, undefined, false, accountKey);
  }

  async getCases(
    branchId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
    page = 1,
    pageSize = 200,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    let url = `/api/v1/gr/cases/list?page=${page}&pageSize=${pageSize}&sortDir=asc`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    } else if (updatedSince) {
      url += `&updatedSince=${encodeURIComponent(updatedSince)}`;
    }

    try {
      return await this.request(url, {}, branchId, false, accountKey);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: [], pagination: { total: 0, totalPages: 1 } };
      }
      throw error;
    }
  }

  async getCaseDetail(
    caseId: string,
    branchId: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    return this.request(
      `/api/v1/gr/cases/detail?id=${caseId}`,
      {},
      branchId,
      false,
      accountKey,
    );
  }

  async getDashboard(
    branchId: string,
    from?: string,
    to?: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    let url = '/api/v1/gr/dashboard/overview';
    if (from && to) {
      url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    try {
      return await this.request(url, {}, branchId, false, accountKey);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return {
          results: {
            Phieu: { Tong: 0 },
            Tien: { TongDoanhThu: 0, TongDaThu: 0, TongConPhaiThu: 0 },
            ChiPhi: {},
            LoiNhuan: {},
          },
        };
      }
      throw error;
    }
  }

  async getGrossProfitDetail(
    branchId: string,
    from: string,
    to: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    const url = `/api/v1/gr/reports/gross-profit-detail?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this.request(url, {}, branchId, false, accountKey);
  }

  async getGrossProfitJournal(
    branchId: string,
    from: string,
    to: string,
    vuViecID?: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    let url = `/api/v1/gr/reports/gross-profit-detail/journal?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (vuViecID) {
      url += `&vuViecID=${encodeURIComponent(vuViecID)}`;
    }
    return this.request(url, {}, branchId, false, accountKey);
  }

  async getReceivables(
    branchId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
    page = 1,
    pageSize = 200,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    let url = `/api/v1/gr/exports/receivables?page=${page}&pageSize=${pageSize}&sortDir=asc`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    } else if (updatedSince) {
      url += `&updatedSince=${encodeURIComponent(updatedSince)}`;
    }

    try {
      return await this.request(url, {}, branchId, false, accountKey);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: [], pagination: { total: 0, totalPages: 1 } };
      }
      throw error;
    }
  }

  async getPayables(
    branchId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
    page = 1,
    pageSize = 200,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<any> {
    let url = `/api/v1/gr/exports/payables?page=${page}&pageSize=${pageSize}&sortDir=asc`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    } else if (updatedSince) {
      url += `&updatedSince=${encodeURIComponent(updatedSince)}`;
    }

    try {
      return await this.request(url, {}, branchId, false, accountKey);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return {
          results: { data: [], pagination: { total: 0, totalPages: 1 } },
        };
      }
      throw error;
    }
  }
}
