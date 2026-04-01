import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BookingsService } from '../bookings/bookings.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import {
  ResponseMessages,
  SuccessResponse,
} from '../common/dto/api-response.dto';

@Controller('admin/events')
@UseGuards(AdminJwtAuthGuard)
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /admin/events/:id/bookings
   * Returns all bookings for a given event.
   * Guarded by AdminJwtAuthGuard — admin access only.
   */
  @Get(':id/bookings')
  async findByEvent(@Param('id') eventId: string) {
    const bookings = await this.bookingsService.findByEvent(eventId);
    return new SuccessResponse(bookings, ResponseMessages.RETRIEVED);
  }
}
