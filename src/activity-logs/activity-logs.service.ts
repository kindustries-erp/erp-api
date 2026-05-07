import {
  UnauthorizedException,
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qs from 'qs';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly configService: ConfigService) {}

  async findAll(query: any, userToken?: string) {
    if (!userToken) {
      throw new UnauthorizedException(
        'Yêu cầu User Token để thực hiện tác vụ này',
      );
    }
    try {
      const page = query.page ? parseInt(query.page) : 1;
      const pageSize = query.pageSize ? parseInt(query.pageSize) : 20;

      // Mặc định sort giảm dần theo timestamp nếu không truyền
      const sort = query.sort || '-timestamp';
      const offset = (page - 1) * pageSize;

      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
      const token = userToken;

      // Tách các query parameters liên quan đến filter/fields ra khỏi page/pageSize
      const {
        page: _p,
        pageSize: _ps,
        sort: _s,
        search: _search,
        action,
        date_from,
        date_to,
        collection,
        user,
        ...directusFilters
      } = query;

      // Khởi tạo filter object nếu chưa có
      if (!directusFilters.filter) {
        directusFilters.filter = {};
      }

      // Hỗ trợ map các tham số query phẳng (flat queries) từ Frontend sang chuẩn Directus Filter
      if (action) {
        directusFilters.filter.action = { _eq: action };
      }
      if (collection) {
        directusFilters.filter.collection = { _eq: collection };
      }
      if (user) {
        directusFilters.filter.user = { _eq: user };
      }
      if (date_from || date_to) {
        directusFilters.filter.timestamp = {};
        if (date_from) {
          directusFilters.filter.timestamp._gte = new Date(
            date_from,
          ).toISOString();
        }
        if (date_to) {
          // Thêm thời gian cuối ngày cho date_to
          const toDate = new Date(date_to);
          toDate.setUTCHours(23, 59, 59, 999);
          directusFilters.filter.timestamp._lte = toDate.toISOString();
        }
      }

      const queryParams: any = {
        limit: pageSize,
        offset: offset,
        meta: 'filter_count',
        sort: Array.isArray(sort) ? sort : [sort],
        fields: '*,user.first_name,user.last_name,user.email',
        ...directusFilters, // Nối các filter đã map và các query tùy biến khác
      };

      if (_search) {
        queryParams.search = _search;
      }

      // Dùng qs.stringify để parse object (như filter[_and][0][collection]) thành đúng định dạng URL encoding
      const queryString = qs.stringify(queryParams, {
        arrayFormat: 'brackets',
        encode: false,
      });
      const url = `${directusUrl}/activity?${queryString}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Directus Error Body: ${errText}`);
        throw new Error(`Directus Error: ${response.statusText} - ${errText}`);
      }

      const result = await response.json();
      const total = result.meta?.filter_count || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy log hoạt động', error);
      if (error.message.includes('Forbidden')) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập vào Activity Logs (directus_activity).',
        );
      }
      throw new BadRequestException(`Lỗi Directus: ${error.message}`);
    }
  }
}
