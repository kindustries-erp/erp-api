import { ApiProperty } from '@nestjs/swagger';

/** Phần response chung cho entity có field liên kết: danh sách field đang khác nguồn. */
export class LinkOverrideMetaDto {
  @ApiProperty({
    type: [String],
    description: 'Khóa field (camelCase) đã sửa cục bộ so với nguồn liên kết',
  })
  overriddenFields: string[];
}
