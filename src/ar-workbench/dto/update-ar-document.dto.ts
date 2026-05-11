import { PartialType } from '@nestjs/swagger';
import { CreateArDocumentDto } from './create-ar-document.dto';

export class UpdateArDocumentDto extends PartialType(CreateArDocumentDto) {}
