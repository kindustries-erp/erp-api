import { IsNotEmpty, IsString } from 'class-validator';

export class CheckWarrantyDto {
  @IsString()
  @IsNotEmpty()
  sokhung: string;

  @IsString()
  @IsNotEmpty()
  somay: string;
}
