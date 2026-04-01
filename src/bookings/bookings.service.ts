import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBooking(eventId: string, dto: CreateBookingDto) {
    const MAX_RETRIES = 5;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // 1. Fetch event — only PUBLISHED events accept bookings
            const event = await tx.event.findUnique({ where: { id: eventId } });
            if (!event || event.status !== EventStatus.PUBLISHED) {
              throw new NotFoundException(
                `Event with id "${eventId}" not found`,
              );
            }

            // 2. Sum all existing bookings for this event
            const agg = await tx.booking.aggregate({
              where: { eventId },
              _sum: { participant_count: true },
            });
            const bookedSeats = agg._sum.participant_count ?? 0;
            const remaining = event.capacity - bookedSeats;

            // 3. Guard: requested count must not exceed remaining capacity
            if (dto.participant_count > remaining) {
              throw new BadRequestException(
                `Not enough seats. Remaining seats: ${remaining}`,
              );
            }

            // 4. Create the booking
            return tx.booking.create({
              data: {
                eventId,
                email: dto.email,
                participant_count: dto.participant_count,
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        // P2034: Transaction conflict / serialization failure — retry
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          attempt++;
          if (attempt >= MAX_RETRIES) {
            throw error;
          }
          continue;
        }
        // All other errors (NotFoundException, BadRequestException, etc.) propagate immediately
        throw error;
      }
    }
  }

  async findByEvent(eventId: string) {
    return this.prisma.booking.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
