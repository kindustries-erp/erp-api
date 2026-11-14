import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateLoanDto } from './create-loan.dto';

export class BatchCreateLoansDto {
  @ApiProperty({
    type: [CreateLoanDto],
    description: 'Danh sách các khoản vay cần lưu vào hệ thống',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLoanDto)
  loans: CreateLoanDto[];
}
