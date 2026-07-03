import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraAuth } from './entities/kgara_auth.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KgaraAuthService {
  private readonly logger = new Logger(KgaraAuthService.name);

  private refreshPromise: Promise<string | null> | null = null;

  constructor(
    @InjectRepository(KgaraAuth)
    private authRepo: Repository<KgaraAuth>,
    private configService: ConfigService,
  ) {}

  async getValidToken(): Promise<string | null> {
    const auths = await this.authRepo.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const auth = auths.length > 0 ? auths[0] : null;
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (
      auth &&
      auth.accessToken &&
      auth.tokenExpires &&
      auth.tokenExpires > fiveMinutesFromNow
    ) {
      return auth.accessToken;
    }

    if (auth && auth.refreshToken) {
      return this.executeRefreshLocked(auth.refreshToken);
    }

    return this.login();
  }

  async forceRefreshToken(): Promise<string | null> {
    const auths = await this.authRepo.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const auth = auths.length > 0 ? auths[0] : null;

    if (auth && auth.refreshToken) {
      return this.executeRefreshLocked(auth.refreshToken);
    }

    return this.login();
  }

  private executeRefreshLocked(
    refreshTokenStr: string,
  ): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshToken(refreshTokenStr).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async login(): Promise<string | null> {
    this.logger.log('Logging in to Kgara API');
    const host = this.configService.get<string>('KGARA_API_HOST');
    const username = this.configService.get<string>('KGARA_USERNAME');
    const password = this.configService.get<string>('KGARA_PASSWORD');
    const makhachhang = this.configService.get<string>('KGARA_MA_KHACH_HANG');

    if (!host || !username || !password || !makhachhang) {
      this.logger.error('Kgara credentials not fully configured.');
      return null;
    }

    try {
      const response = await fetch(`https://${host}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: username,
          Password: password,
          MaKhachHang: makhachhang,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.saveTokens(data);
    } catch (error) {
      this.logger.error(`Failed to login: ${error.message}`);
      return null;
    }
  }

  private async refreshToken(refreshTokenStr: string): Promise<string | null> {
    this.logger.log('Refreshing Kgara token');
    const host = this.configService.get<string>('KGARA_API_HOST');
    const makhachhang = this.configService.get<string>('KGARA_MA_KHACH_HANG');

    try {
      const response = await fetch(
        `https://${host}/api/v1/auth/refresh-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            MaKhachHang: makhachhang,
            RefreshToken: refreshTokenStr,
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn('Refresh failed, falling back to login');
        return this.login();
      }

      const data = await response.json();
      return this.saveTokens(data);
    } catch (error) {
      this.logger.error(`Failed to refresh token: ${error.message}`);
      return this.login();
    }
  }

  private async saveTokens(data: any): Promise<string> {
    const auth = new KgaraAuth();
    auth.accessToken = data.AccessToken;
    auth.refreshToken = data.RefreshToken;
    auth.tokenExpires = new Date(data.TokenExpires);
    auth.ssClientId = data.SS_ClientID || ''; // Default branch ID

    // Optional cleanup of old tokens
    await this.authRepo.clear();
    await this.authRepo.save(auth);

    return auth.accessToken as string;
  }
}
