import { Injectable, Logger } from '@nestjs/common';

export interface BankLogoPayload {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class BanksManagementLogoService {
  private readonly logger = new Logger(BanksManagementLogoService.name);
  private readonly cache = new Map<string, BankLogoPayload>();

  private buildFallbackSvg(code: string): string {
    const safeCode = (code || 'BANK').toUpperCase().slice(0, 8);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="24" fill="#0f172a"/>
  <rect x="2" y="2" width="116" height="116" rx="22" fill="none" stroke="#334155" stroke-width="2"/>
  <text x="60" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="#10b981" text-anchor="middle">${safeCode}</text>
</svg>`;
  }

  async getLogoBuffer(code: string): Promise<BankLogoPayload> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return {
        buffer: Buffer.from(this.buildFallbackSvg('BANK'), 'utf-8'),
        contentType: 'image/svg+xml',
      };
    }

    const cached = this.cache.get(cleanCode);
    if (cached) {
      return cached;
    }

    try {
      const url = `https://cdn.vietqr.io/img/${cleanCode}.png`;
      const response = await fetch(url, {
        headers: { Accept: 'image/png,image/*;q=0.8' },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const payload: BankLogoPayload = {
          buffer: Buffer.from(arrayBuffer),
          contentType: 'image/png',
        };
        this.cache.set(cleanCode, payload);
        return payload;
      }
      this.logger.warn(
        `VietQR logo response not OK for ${cleanCode}: ${response.status}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to fetch bank logo for ${cleanCode}: ${(err as Error).message}`,
      );
    }

    // Trả về vector SVG placeholder khi lỗi mạng hoặc không tìm thấy logo
    return {
      buffer: Buffer.from(this.buildFallbackSvg(cleanCode), 'utf-8'),
      contentType: 'image/svg+xml',
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
