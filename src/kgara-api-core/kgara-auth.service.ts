import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraAuth } from './entities/kgara_auth.entity';
import { ConfigService } from '@nestjs/config';
import { KgaraAccountKey } from './enums/kgara-account.enum';

export interface KgaraAccountCredentials {
  host: string;
  username: string;
  password: string;
  makhachhang: string;
}

@Injectable()
export class KgaraAuthService {
  private readonly logger = new Logger(KgaraAuthService.name);
  private refreshPromises = new Map<string, Promise<string | null>>();

  constructor(
    @InjectRepository(KgaraAuth)
    private authRepo: Repository<KgaraAuth>,
    private configService: ConfigService,
  ) {}

  getCredentials(
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): KgaraAccountCredentials | null {
    if (accountKey === KgaraAccountKey.OJ) {
      const host =
        this.configService.get<string>('KGARA_OJ_API_HOST') ||
        this.configService.get<string>('KGARA_API_HOST');
      const username =
        this.configService.get<string>('KGARA_OJ_USERNAME') ||
        this.configService.get<string>('KGARA_USERNAME_2');
      const password =
        this.configService.get<string>('KGARA_OJ_PASSWORD') ||
        this.configService.get<string>('KGARA_PASSWORD_2');
      const makhachhang =
        this.configService.get<string>('KGARA_OJ_MA_KHACH_HANG') ||
        this.configService.get<string>('KGARA_MA_KHACH_HANG_2');

      if (!host || !username || !password || !makhachhang) {
        this.logger.error('Kgara OJ credentials not fully configured.');
        return null;
      }
      return { host, username, password, makhachhang };
    }

    // Default: MAIN account
    const host = this.configService.get<string>('KGARA_API_HOST');
    const username = this.configService.get<string>('KGARA_USERNAME');
    const password = this.configService.get<string>('KGARA_PASSWORD');
    const makhachhang = this.configService.get<string>('KGARA_MA_KHACH_HANG');

    if (!host || !username || !password || !makhachhang) {
      this.logger.error('Kgara MAIN credentials not fully configured.');
      return null;
    }
    return { host, username, password, makhachhang };
  }

  async getValidToken(
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<string | null> {
    const auth = await this.authRepo.findOne({
      where: { accountKey },
      order: { createdAt: 'DESC' },
    });
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
      return this.executeRefreshLocked(auth.refreshToken, accountKey);
    }

    return this.login(accountKey);
  }

  async forceRefreshToken(
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<string | null> {
    const auth = await this.authRepo.findOne({
      where: { accountKey },
      order: { createdAt: 'DESC' },
    });

    if (auth && auth.refreshToken) {
      return this.executeRefreshLocked(auth.refreshToken, accountKey);
    }

    return this.login(accountKey);
  }

  private executeRefreshLocked(
    refreshTokenStr: string,
    accountKey: KgaraAccountKey,
  ): Promise<string | null> {
    const key = accountKey.toString();
    const existing = this.refreshPromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = this.refreshToken(refreshTokenStr, accountKey).finally(
      () => {
        this.refreshPromises.delete(key);
      },
    );
    this.refreshPromises.set(key, promise);
    return promise;
  }

  private async login(accountKey: KgaraAccountKey): Promise<string | null> {
    this.logger.log(`Logging in to Kgara API for account: ${accountKey}`);
    const creds = this.getCredentials(accountKey);
    if (!creds) {
      return null;
    }

    try {
      const response = await fetch(`https://${creds.host}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: creds.username,
          Password: creds.password,
          MaKhachHang: creds.makhachhang,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.saveTokens(data, accountKey);
    } catch (error: any) {
      this.logger.error(
        `Failed to login for account ${accountKey}: ${error?.message}`,
      );
      return null;
    }
  }

  private async refreshToken(
    refreshTokenStr: string,
    accountKey: KgaraAccountKey,
  ): Promise<string | null> {
    this.logger.log(`Refreshing Kgara token for account: ${accountKey}`);
    const creds = this.getCredentials(accountKey);
    if (!creds) {
      return null;
    }

    try {
      const response = await fetch(
        `https://${creds.host}/api/v1/auth/refresh-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            MaKhachHang: creds.makhachhang,
            RefreshToken: refreshTokenStr,
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Refresh failed for account ${accountKey}, falling back to login`,
        );
        return this.login(accountKey);
      }

      const data = await response.json();
      return this.saveTokens(data, accountKey);
    } catch (error: any) {
      this.logger.error(
        `Failed to refresh token for account ${accountKey}: ${error?.message}`,
      );
      return this.login(accountKey);
    }
  }

  private async saveTokens(
    data: any,
    accountKey: KgaraAccountKey,
  ): Promise<string> {
    let auth = await this.authRepo.findOne({ where: { accountKey } });
    if (!auth) {
      auth = new KgaraAuth();
      auth.accountKey = accountKey;
    }

    auth.accessToken = data.AccessToken;
    auth.refreshToken = data.RefreshToken;
    auth.tokenExpires = new Date(data.TokenExpires);
    auth.ssClientId = data.SS_ClientID || '';

    await this.authRepo.save(auth);
    return auth.accessToken as string;
  }
}
