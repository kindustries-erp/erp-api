import { IsNotEmpty, IsString } from 'class-validator';

export class CheckWarrantyDto {
  @IsString()
  @IsNotEmpty()
  vin_no: string;

  @IsString()
  @IsNotEmpty()
  engine_no: string;
}
