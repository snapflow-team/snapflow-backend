import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCheckoutSessionInputDto {
  @IsString()
  @IsNotEmpty()
  planId: string;
}
