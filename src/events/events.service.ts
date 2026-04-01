import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory, EventStatus, Prisma } from '@prisma/client';
import { GetEventsQueryDto } from './dto/events.dto';
import { CreateEventDto } from '../admin/dto/admin-events.dto';
import { UpdateEventDto } from '../admin/dto/admin-events.dto';
import { UpdateEventStatusDto } from '../admin/dto/admin-events.dto';

export type EventWithCapacity = Prisma.EventGetPayload<
  Record<string, never>
> & {
  remaining_capacity: number;
};

export interface EventsPaginatedResult {
  data: EventWithCapacity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetEventsQueryDto): Promise<EventsPaginatedResult> {
    // Safety-net defaults in case DTO defaults did not apply (e.g., tests passing {})
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { category, search } = query;

    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED, // Always hardcoded — public endpoint never exposes drafts
      ...(category && { category }),
      ...(search && {
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive' as const, // Prevents TS "string not assignable to QueryMode"
            },
          },
          {
            description: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
      }),
      this.prisma.event.count({ where }),
    ]);

    // Avoid N+1: fetch aggregated booking sums for all event IDs in one query
    const eventIds = events.map((e) => e.id);
    const bookingSums = eventIds.length
      ? await this.prisma.booking.groupBy({
          by: ['eventId'],
          _sum: { participant_count: true },
          where: { eventId: { in: eventIds } },
        })
      : [];

    // Build a lookup map: eventId -> total booked seats
    const bookedMap = new Map<string, number>(
      bookingSums.map((b) => [b.eventId, b._sum.participant_count ?? 0]),
    );

    // Merge remaining_capacity into each event
    const data: EventWithCapacity[] = events.map((event) => ({
      ...event,
      remaining_capacity: event.capacity - (bookedMap.get(event.id) ?? 0),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<EventWithCapacity> {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    // Treat DRAFT and CANCELLED the same as not-found for the public API (per EVT-03)
    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }

    // Single aggregate for remaining capacity
    const agg = await this.prisma.booking.aggregate({
      where: { eventId: id },
      _sum: { participant_count: true },
    });
    const bookedSeats = agg._sum.participant_count ?? 0;

    return {
      ...event,
      remaining_capacity: event.capacity - bookedSeats,
    };
  }

  // ── Admin methods (all statuses, all events) ────────────────────────────

  async findAllAdmin(query: {
    category?: EventCategory;
    status?: EventStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<EventsPaginatedResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { category, status, search } = query;

    const where: Prisma.EventWhereInput = {
      // No status hardcode — admin sees all statuses unless explicitly filtered
      ...(status && { status }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
      }),
      this.prisma.event.count({ where }),
    ]);

    // Avoid N+1: fetch aggregated booking sums for all event IDs in one query
    const eventIds = events.map((e) => e.id);
    const bookingSums = eventIds.length
      ? await this.prisma.booking.groupBy({
          by: ['eventId'],
          _sum: { participant_count: true },
          where: { eventId: { in: eventIds } },
        })
      : [];

    const bookedMap = new Map<string, number>(
      bookingSums.map((b) => [b.eventId, b._sum.participant_count ?? 0]),
    );

    const data: EventWithCapacity[] = events.map((event) => ({
      ...event,
      remaining_capacity: event.capacity - (bookedMap.get(event.id) ?? 0),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneAdmin(
    id: string,
  ): Promise<Prisma.EventGetPayload<Record<string, never>>> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }
    return event;
  }

  async createEvent(
    dto: CreateEventDto,
  ): Promise<Prisma.EventGetPayload<Record<string, never>>> {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        price: dto.price,
        date: new Date(dto.date), // Prisma DateTime @db.Date accepts JS Date
        start_time: dto.start_time,
        duration_minutes: dto.duration_minutes,
        capacity: dto.capacity,
        status: dto.status ?? EventStatus.DRAFT,
        location: dto.location,
        image_url: dto.image_url ?? null,
      },
    });
  }

  async updateEvent(
    id: string,
    dto: UpdateEventDto,
  ): Promise<Prisma.EventGetPayload<Record<string, never>>> {
    await this.findOneAdmin(id); // throws NotFoundException if not found

    return this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        price: dto.price,
        date: new Date(dto.date),
        start_time: dto.start_time,
        duration_minutes: dto.duration_minutes,
        capacity: dto.capacity,
        status: dto.status,
        location: dto.location,
        image_url: dto.image_url ?? null,
      },
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.findOneAdmin(id); // throws NotFoundException if not found
    await this.prisma.event.delete({ where: { id } });
  }

  async updateEventStatus(
    id: string,
    dto: UpdateEventStatusDto,
  ): Promise<Prisma.EventGetPayload<Record<string, never>>> {
    await this.findOneAdmin(id); // throws NotFoundException if not found

    return this.prisma.event.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
