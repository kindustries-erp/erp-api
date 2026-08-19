import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CoreUserPreference } from '../users/entities/core-user-preference.entity';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(CoreUserPreference)
    private readonly preferenceRepo: Repository<CoreUserPreference>,
    private readonly configService: ConfigService,
  ) {}

  getPublicConfig() {
    const appEnv =
      this.configService.get<string>('APP_ENV') ||
      process.env.APP_ENV ||
      'development';

    return {
      appEnv,
      appName: 'Liouni ERP',
      version: '1.0.0',
    };
  }

  async getUserPreferences(userId: string): Promise<CoreUserPreference> {
    let pref = await this.preferenceRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.preferenceRepo.create({
        userId,
        theme: 'classic',
        language: 'vi',
        tableConfigs: {},
        uiConfigs: {},
      });
      pref = await this.preferenceRepo.save(pref);
    }
    return pref;
  }

  async updateUserPreferences(
    userId: string,
    dto: UpdateUserPreferenceDto,
  ): Promise<CoreUserPreference> {
    const pref = await this.getUserPreferences(userId);

    if (dto.theme !== undefined) {
      pref.theme = dto.theme;
    }

    if (dto.language !== undefined) {
      pref.language = dto.language;
    }

    if (dto.tableConfigs !== undefined) {
      pref.tableConfigs = {
        ...(pref.tableConfigs || {}),
        ...dto.tableConfigs,
      };
    }

    if (dto.uiConfigs !== undefined) {
      pref.uiConfigs = {
        ...(pref.uiConfigs || {}),
        ...dto.uiConfigs,
      };
    }

    return await this.preferenceRepo.save(pref);
  }
}
