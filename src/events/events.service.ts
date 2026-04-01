import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, Prisma } from '@prisma/client';
import { GetEventsQueryDto } from './dto/events.dto';

export interface EventsPaginatedResult {
  data: Prisma.EventGetPayload<Record<string, never>>[];
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

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
  ): Promise<Prisma.EventGetPayload<Record<string, never>>> {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    // Treat DRAFT and CANCELLED the same as not-found for the public API (per EVT-03)
    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }

    return event;
  }
}
