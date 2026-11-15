import { TableQueryDto } from '@/common/dto/table-query.dto';

/** `status` đã có trong `PaginationDto`; lọc theo trạng thái dùng tham số đó hoặc `column_filters`. */
export class QueryUserDto extends TableQueryDto {}
