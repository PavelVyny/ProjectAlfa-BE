import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  ResponseMessages,
  SuccessResponse,
} from '../common/dto/api-response.dto';

@Controller('events')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /events/:id/book
   * Public endpoint — no auth guard.
   * Anyone can book a published event.
   */
  @Post(':id/book')
  async createBooking(
    @Param('id') eventId: string,
    @Body() dto: CreateBookingDto,
  ) {
    const booking = await this.bookingsService.createBooking(eventId, dto);
    return new SuccessResponse(booking, ResponseMessages.CREATED);
  }

  /**
   * GET /events/:id/bookings
   * Admin-accessible listing of all bookings for an event.
   * (Auth guard can be layered by the Admin module if desired; left open for now.)
   */
  @Get(':id/bookings')
  async findByEvent(@Param('id') eventId: string) {
    const bookings = await this.bookingsService.findByEvent(eventId);
    return new SuccessResponse(bookings, ResponseMessages.RETRIEVED);
  }
}
