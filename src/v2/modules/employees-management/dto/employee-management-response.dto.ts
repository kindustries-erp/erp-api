import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeLinkedUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
}

export class EmployeeBranchDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

/** Hình dạng dữ liệu trả ra API. Không trả entity; CCCD chỉ trả bản che. */
export class EmployeeManagementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;

  @ApiProperty()
  employeeCode: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  birthDate?: Date;

  @ApiPropertyOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  leaveDate?: Date;

  @ApiPropertyOptional()
  jobTitle?: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiPropertyOptional()
  branchId?: string;

  @ApiPropertyOptional({ type: () => EmployeeBranchDto })
  branch?: EmployeeBranchDto | null;

  @ApiPropertyOptional({ description: 'CCCD đã che, ví dụ ********1234' })
  nationalIdMasked?: string;

  @ApiPropertyOptional({ type: () => EmployeeLinkedUserDto })
  linkedUser?: EmployeeLinkedUserDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
