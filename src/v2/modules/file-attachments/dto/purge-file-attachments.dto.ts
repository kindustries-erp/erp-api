import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { MAX_PURGE_BATCH } from '../services/file-attachment-purge.service';

export class PurgeFileAttachmentsBodyDto {
  @ApiProperty({
    type: [String],
    description: `Tối đa ${MAX_PURGE_BATCH} id; chỉ file đã xóa mềm mới bị xóa cứng`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PURGE_BATCH)
  @IsUUID('all', { each: true })
  ids: string[];
}
