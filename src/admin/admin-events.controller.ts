import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { EventCategory, EventStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EventsService } from '../events/events.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateEventStatusDto,
} from './dto/admin-events.dto';
import {
  SuccessResponse,
  ResponseMessages,
} from '../common/dto/api-response.dto';

// Inline admin query DTO — adds status filter on top of public DTO
class AdminGetEventsQueryDto {
  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

@Controller('admin/events')
@UseGuards(AdminJwtAuthGuard) // per D-05: all endpoints guarded
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * GET /admin/events
   * Lists all events regardless of status. Supports filtering by category, status, search.
   * Per ACRUD-01.
   */
  @Get()
  async findAll(@Query() query: AdminGetEventsQueryDto) {
    const result = await this.eventsService.findAllAdmin(query);
    return new SuccessResponse(result, ResponseMessages.RETRIEVED);
  }

  /**
   * POST /admin/events
   * Creates a new event. Status defaults to DRAFT if not provided.
   * Per ACRUD-02.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEventDto) {
    const event = await this.eventsService.createEvent(dto);
    return new SuccessResponse(event, ResponseMessages.CREATED);
  }

  /**
   * PUT /admin/events/:id
   * Full replace of an event record. Returns 404 if event not found.
   * Per ACRUD-03.
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    const event = await this.eventsService.updateEvent(id, dto);
    return new SuccessResponse(event, ResponseMessages.UPDATED);
  }

  /**
   * DELETE /admin/events/:id
   * Hard deletes the event row. Returns 404 if not found.
   * Per ACRUD-04. Hard delete per phase scope (D-06 / Claude's Discretion).
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.eventsService.deleteEvent(id);
    return new SuccessResponse(null, ResponseMessages.DELETED);
  }

  /**
   * PATCH /admin/events/:id/status
   * Changes event status only. PUBLISHED → visible on public GET /events.
   * DRAFT/CANCELLED → hidden from public API (per events.service.ts findAll PUBLISHED-only filter).
   * Per ACRUD-05.
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
  ) {
    const event = await this.eventsService.updateEventStatus(id, dto);
    return new SuccessResponse(event, ResponseMessages.UPDATED);
  }
}
