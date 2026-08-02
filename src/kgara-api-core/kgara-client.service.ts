import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KgaraAuthService } from './kgara-auth.service';

@Injectable()
export class KgaraClientService {
  private readonly logger = new Logger(KgaraClientService.name);

  constructor(
    private authService: KgaraAuthService,
    private configService: ConfigService,
  ) {}

  async request(
    endpoint: string,
    options: RequestInit = {},
    branchId?: string,
    isRetry = false,
  ): Promise<any> {
    const token = await this.authService.getValidToken();
    if (!token) {
      throw new Error('Could not obtain Kgara token');
    }

    const host = this.configService.get<string>('KGARA_API_HOST');
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
          'Received 401 Unauthorized, refreshing token and retrying...',
        );
        await this.authService.forceRefreshToken();
        return this.request(endpoint, options, branchId, true); // Retry once
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

    return response.json();
  }

  async getBranches(): Promise<any[]> {
    return this.request('/api/v1/donvi/list');
  }

  async getCases(
    branchId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
    page = 1,
    pageSize = 200,
  ): Promise<any> {
    let url = `/api/v1/gr/cases/list?page=${page}&pageSize=${pageSize}&sortDir=asc`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    } else if (updatedSince) {
      url += `&updatedSince=${encodeURIComponent(updatedSince)}`;
    }

    try {
      return await this.request(url, {}, branchId);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: [], pagination: { total: 0, totalPages: 1 } };
      }
      throw error;
    }
  }

  async getCaseDetail(caseId: string, branchId: string): Promise<any> {
    return this.request(`/api/v1/gr/cases/detail?id=${caseId}`, {}, branchId);
  }

  async getDashboard(
    branchId: string,
    from?: string,
    to?: string,
  ): Promise<any> {
    let url = '/api/v1/gr/dashboard/overview';
    if (from && to) {
      url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    try {
      return await this.request(url, {}, branchId);
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
  ): Promise<any> {
    const url = `/api/v1/gr/reports/gross-profit-detail?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this.request(url, {}, branchId);
  }

  async getGrossProfitJournal(
    branchId: string,
    from: string,
    to: string,
    vuViecID?: string,
  ): Promise<any> {
    let url = `/api/v1/gr/reports/gross-profit-detail/journal?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (vuViecID) {
      url += `&vuViecID=${encodeURIComponent(vuViecID)}`;
    }
    return this.request(url, {}, branchId);
  }

  async getReceivables(
    branchId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
    page = 1,
    pageSize = 200,
  ): Promise<any> {
    let url = `/api/v1/gr/exports/receivables?page=${page}&pageSize=${pageSize}&sortDir=asc`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    } else if (updatedSince) {
      url += `&updatedSince=${encodeURIComponent(updatedSince)}`;
    }

    try {
      return await this.request(url, {}, branchId);
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
  ): Promise<any> {
    let url = `/api/v1/gr/exports/payables?page=${page}&pageSize=${pageSize}&sortDir=asc`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    } else if (updatedSince) {
      url += `&updatedSince=${encodeURIComponent(updatedSince)}`;
    }

    try {
      return await this.request(url, {}, branchId);
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
