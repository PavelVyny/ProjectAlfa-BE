import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { GetEventsQueryDto } from './dto/events.dto';
import {
  SuccessResponse,
  ResponseMessages,
} from '../common/dto/api-response.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(@Query() query: GetEventsQueryDto) {
    const result = await this.eventsService.findAll(query);
    // Return SuccessResponse directly so ResponseInterceptor passes it through unchanged
    // (interceptor detects 'success' key and skips double-wrapping).
    // Wire format: { success, message, data: { data: Event[], meta: {...} }, meta: { executionTime }, timestamp, requestId }
    // Phase 6 reads: response.data.data (events array) and response.data.meta (pagination meta)
    return new SuccessResponse(result, ResponseMessages.RETRIEVED);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id);
    return new SuccessResponse(event, ResponseMessages.RETRIEVED);
  }
}
