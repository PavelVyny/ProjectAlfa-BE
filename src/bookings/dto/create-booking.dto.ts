import { IsEmail, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateBookingDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsInt()
  @Min(1)
  participant_count: number;
}
