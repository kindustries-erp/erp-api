import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Gán hãng bảo hiểm (hoặc NCC) cho một dòng nợ. */
export class AssignDebtPartyDto {
  @ApiProperty({ description: 'Mã hãng / NCC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  partyCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  partyName?: string;

  @ApiPropertyOptional({ description: 'Đối tác trong business-partners' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;
}
