import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BusinessPartnerQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Lọc đối tác theo role trong business_partner_roles (VD: CUSTOMER, VENDOR)',
    example: 'VENDOR',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
