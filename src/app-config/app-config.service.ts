import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CoreUserPreference } from '../users/entities/core-user-preference.entity';
import { CoreUserTablePreference } from '../users/entities/core-user-table-preference.entity';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
import { UpdateTablePreferenceDto } from './dto/table-preference.dto';
import {
  QueryChangelogDto,
  PaginatedChangelogResponse,
} from './dto/query-changelog.dto';
import { MASTER_CHANGELOG_RELEASES } from './data/changelog-data';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(CoreUserPreference)
    private readonly preferenceRepo: Repository<CoreUserPreference>,
    @InjectRepository(CoreUserTablePreference)
    private readonly tablePreferenceRepo: Repository<CoreUserTablePreference>,
    private readonly configService: ConfigService,
  ) {}

  getPublicConfig() {
    const appEnv =
      this.configService.get<string>('APP_ENV') ||
      process.env.APP_ENV ||
      'development';

    return {
      appEnv,
      appName: 'ERP',
      version: '1.0.0',
    };
  }

  async getUserPreferences(userId: string): Promise<CoreUserPreference> {
    try {
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
    } catch (error) {
      return {
        id: '',
        userId,
        theme: 'classic',
        language: 'vi',
        tableConfigs: {},
        uiConfigs: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CoreUserPreference;
    }
  }

  async updateUserPreferences(
    userId: string,
    dto: UpdateUserPreferenceDto,
  ): Promise<CoreUserPreference> {
    try {
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
    } catch (error) {
      return {
        id: '',
        userId,
        theme: dto.theme || 'classic',
        language: dto.language || 'vi',
        tableConfigs: dto.tableConfigs || {},
        uiConfigs: dto.uiConfigs || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CoreUserPreference;
    }
  }

  /** Trả về map `tableId -> { columns, views }` của user */
  async getTablePreferences(userId: string) {
    const rows = await this.tablePreferenceRepo.find({ where: { userId } });
    return rows.reduce<
      Record<string, Pick<CoreUserTablePreference, 'columns' | 'views'>>
    >((acc, row) => {
      acc[row.tableId] = { columns: row.columns, views: row.views };
      return acc;
    }, {});
  }

  /** Ghi đè từng phần (`columns` / `views`) được gửi lên; phần không gửi giữ nguyên */
  async updateTablePreference(
    userId: string,
    tableId: string,
    dto: UpdateTablePreferenceDto,
  ) {
    if (!tableId || tableId.length > 200) {
      throw new BadRequestException('tableId không hợp lệ');
    }

    let row = await this.tablePreferenceRepo.findOne({
      where: { userId, tableId },
    });
    if (!row) {
      row = this.tablePreferenceRepo.create({
        userId,
        tableId,
        columns: {},
        views: {},
      });
    }

    if (dto.columns !== undefined) {
      row.columns = { ...dto.columns };
    }
    if (dto.views !== undefined) {
      row.views = { ...dto.views };
    }

    const saved = await this.tablePreferenceRepo.save(row);
    return { tableId, columns: saved.columns, views: saved.views };
  }

  getChangelog(query: QueryChangelogDto): PaginatedChangelogResponse {
    const { search, page = 1, limit = 6 } = query;
    let filtered = MASTER_CHANGELOG_RELEASES;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((r) => {
        const matchVersion = r.version.toLowerCase().includes(q);
        const matchTag = r.tag?.toLowerCase().includes(q);
        const matchTitle =
          r.titleVi.toLowerCase().includes(q) ||
          r.titleEn.toLowerCase().includes(q);
        const matchItems = r.items.some(
          (item) =>
            item.textVi.toLowerCase().includes(q) ||
            item.textEn.toLowerCase().includes(q),
        );
        return matchVersion || matchTag || matchTitle || matchItems;
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);
    const hasNextPage = page < totalPages;

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
      },
    };
  }
}
