import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsInt,
  IsPositive,
  IsUrl,
  IsOptional,
  Min,
  Matches,
} from 'class-validator';
import { EventCategory, EventStatus } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(EventCategory, {
    message: `category must be one of: ${Object.values(EventCategory).join(', ')}`,
  })
  category: EventCategory;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  // ISO 8601 date string e.g. "2026-06-15" — Prisma accepts ISO strings for DateTime @db.Date
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time must be in HH:MM format' })
  start_time: string;

  @IsInt()
  @IsPositive()
  duration_minutes: number;

  @IsInt()
  @IsPositive()
  capacity: number;

  @IsEnum(EventStatus, {
    message: `status must be one of: ${Object.values(EventStatus).join(', ')}`,
  })
  @IsOptional()
  status?: EventStatus; // defaults to DRAFT in Prisma schema

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @IsOptional()
  image_url?: string; // per D-03: optional @IsUrl()
}

export class UpdateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(EventCategory, {
    message: `category must be one of: ${Object.values(EventCategory).join(', ')}`,
  })
  category: EventCategory;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time must be in HH:MM format' })
  start_time: string;

  @IsInt()
  @IsPositive()
  duration_minutes: number;

  @IsInt()
  @IsPositive()
  capacity: number;

  @IsEnum(EventStatus, {
    message: `status must be one of: ${Object.values(EventStatus).join(', ')}`,
  })
  @IsOptional()
  status?: EventStatus;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @IsOptional()
  image_url?: string;
}

export class UpdateEventStatusDto {
  @IsEnum(EventStatus, {
    message: `status must be one of: ${Object.values(EventStatus).join(', ')}`,
  })
  status: EventStatus;
}
