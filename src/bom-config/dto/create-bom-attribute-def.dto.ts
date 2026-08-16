import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
export type BomAttributeFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'SELECT'
  | 'DATE'
  | 'CHECKBOX';

export interface BomAttributeOption {
  label: string;
  value: string;
}

export class CreateBomAttributeDefDto {
  @ApiProperty({ description: 'Category UUID' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Attribute code', example: 'color' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: 'Attribute name', example: 'Màu sắc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Field type',
    enum: ['TEXT', 'NUMBER', 'SELECT', 'DATE', 'CHECKBOX'],
    default: 'TEXT',
  })
  @IsIn(['TEXT', 'NUMBER', 'SELECT', 'DATE', 'CHECKBOX'])
  fieldType: BomAttributeFieldType;

  @ApiPropertyOptional({
    description: 'Options for SELECT field type',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        value: { type: 'string' },
      },
    },
  })
  @IsArray()
  @IsOptional()
  options?: BomAttributeOption[];

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Is required', default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
