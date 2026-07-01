import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GreenwayAuthService } from './greenway-auth.service';

@Injectable()
export class GreenwayClientService {
  private readonly logger = new Logger(GreenwayClientService.name);

  constructor(
    private authService: GreenwayAuthService,
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
      throw new Error('Could not obtain Greenway token');
    }

    const host = this.configService.get<string>('GREENWAY_API_HOST');
    const url = `https://${host}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

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
      throw new Error(
        `Greenway API Error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  async getBranches(): Promise<any[]> {
    return this.request('/api/v1/donvi/list');
  }

  async getCases(branchId: string, from?: string, to?: string): Promise<any> {
    // We will use the export API for cases since it supports date ranges and pagination
    // Or we can just get the dashboard overview. We'll use export /cases to get cases to sync
    let url = '/api/v1/gr/exports/cases?page=1&pageSize=500';
    if (from && to) {
      url += `&from=${from}&to=${to}`;
    } else {
      // Default to updatedSince to fetch recent changes if no date provided
      const aWeekAgo = new Date();
      aWeekAgo.setDate(aWeekAgo.getDate() - 7);
      url += `&updatedSince=${aWeekAgo.toISOString()}`;
    }
    try {
      return await this.request(url, {}, branchId);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: [], pagination: { total: 0 } };
      }
      throw error;
    }
  }

  async getCaseDetail(caseId: string, branchId: string): Promise<any> {
    return this.request(`/api/v1/gr/cases/case?id=${caseId}`, {}, branchId);
  }

  async getDashboard(
    branchId: string,
    from?: string,
    to?: string,
  ): Promise<any> {
    let url = '/api/v1/gr/dashboard/overview';
    if (from && to) {
      url += `?from=${from}&to=${to}`;
    }
    try {
      return await this.request(url, {}, branchId);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: { revenue: 0, newCases: 0, completedCases: 0 } };
      }
      throw error;
    }
  }

  async getReceivables(
    branchId: string,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 500,
  ): Promise<any> {
    let url = `/api/v1/gr/exports/receivables?page=${page}&pageSize=${pageSize}`;
    if (from && to) {
      url += `&from=${from}&to=${to}`;
    } else {
      const aWeekAgo = new Date();
      aWeekAgo.setDate(aWeekAgo.getDate() - 7);
      url += `&updatedSince=${aWeekAgo.toISOString()}`;
    }
    try {
      return await this.request(url, {}, branchId);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: [], pagination: { total: 0 } };
      }
      throw error;
    }
  }

  async getPayables(
    branchId: string,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 500,
  ): Promise<any> {
    let url = `/api/v1/gr/exports/payables?page=${page}&pageSize=${pageSize}`;
    if (from && to) {
      url += `&from=${from}&to=${to}`;
    } else {
      const aWeekAgo = new Date();
      aWeekAgo.setDate(aWeekAgo.getDate() - 7);
      url += `&updatedSince=${aWeekAgo.toISOString()}`;
    }
    try {
      return await this.request(url, {}, branchId);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        return { data: [], pagination: { total: 0 } };
      }
      throw error;
    }
  }
}
