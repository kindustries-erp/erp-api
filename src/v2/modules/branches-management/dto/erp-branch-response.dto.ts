import { ApiProperty } from '@nestjs/swagger';

export class ErpBranchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
