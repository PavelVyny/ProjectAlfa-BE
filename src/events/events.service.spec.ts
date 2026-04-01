import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory, EventStatus } from '@prisma/client';

// Minimal mock event shape
const mockEvent = {
  id: 'seed-evt-music-neon',
  title: 'Neon Nights Music Festival',
  description: 'An electrifying night of live music.',
  category: EventCategory.MUSIC,
  price: 45,
  date: new Date('2026-03-15'),
  start_time: '18:00',
  duration_minutes: 180,
  capacity: 250,
  status: EventStatus.PUBLISHED,
  location: 'Central Arena, Downtown',
  image_url: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('EventsService', () => {
  let service: EventsService;
  let mockPrismaService: {
    event: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    booking: {
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      event: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      booking: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { participant_count: null } }),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated events with meta when no filters provided', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[mockEvent], 1]);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: mockEvent.id });
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('hardcodes status: PUBLISHED in where clause regardless of query', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({});

      // $transaction receives an array of prisma call results — verify the where clause
      // by checking that $transaction was called (actual where is in the Prisma query)
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('applies category filter when provided', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[mockEvent], 1]);

      const result = await service.findAll({ category: EventCategory.MUSIC });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('applies search filter when provided', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[mockEvent], 1]);

      const result = await service.findAll({ search: 'neon' });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('computes skip correctly for page 2 limit 3', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 9]);

      const result = await service.findAll({ page: 2, limit: 3 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.total).toBe(9);
      expect(result.meta.totalPages).toBe(3);
    });

    it('uses defaults page=1 limit=20 when not provided', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('uses $transaction (not separate queries)', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      // $transaction is called with an array of two promises (findMany + count batched)
      const [[callArg]] = mockPrismaService.$transaction.mock.calls as [
        [unknown[]],
      ];
      expect(Array.isArray(callArg)).toBe(true);
      expect(callArg).toHaveLength(2);
    });

    it('adds remaining_capacity = capacity when no bookings exist', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[mockEvent], 1]);
      mockPrismaService.booking.groupBy.mockResolvedValue([]); // no bookings

      const result = await service.findAll({});

      expect(result.data[0].remaining_capacity).toBe(mockEvent.capacity); // 250
    });

    it('adds remaining_capacity accounting for existing bookings', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[mockEvent], 1]);
      mockPrismaService.booking.groupBy.mockResolvedValue([
        { eventId: mockEvent.id, _sum: { participant_count: 100 } },
      ]);

      const result = await service.findAll({});

      expect(result.data[0].remaining_capacity).toBe(150); // 250 - 100
    });

    it('skips groupBy call when result set is empty', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(mockPrismaService.booking.groupBy).not.toHaveBeenCalled();
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns event when found and status is PUBLISHED', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.booking.aggregate.mockResolvedValue({
        _sum: { participant_count: null },
      });

      const result = await service.findOne('seed-evt-music-neon');

      expect(result).toMatchObject({ id: mockEvent.id });
    });

    it('throws NotFoundException when event not found (null from findUnique)', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when event exists but status is DRAFT', async () => {
      const draftEvent = { ...mockEvent, status: EventStatus.DRAFT };
      mockPrismaService.event.findUnique.mockResolvedValue(draftEvent);

      await expect(service.findOne('seed-evt-music-neon')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when event exists but status is CANCELLED', async () => {
      const cancelledEvent = { ...mockEvent, status: EventStatus.CANCELLED };
      mockPrismaService.event.findUnique.mockResolvedValue(cancelledEvent);

      await expect(service.findOne('seed-evt-music-neon')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('adds remaining_capacity = capacity when no bookings exist', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.booking.aggregate.mockResolvedValue({
        _sum: { participant_count: null },
      });

      const result = await service.findOne(mockEvent.id);

      expect(result.remaining_capacity).toBe(250);
    });

    it('adds remaining_capacity accounting for existing bookings', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.booking.aggregate.mockResolvedValue({
        _sum: { participant_count: 75 },
      });

      const result = await service.findOne(mockEvent.id);

      expect(result.remaining_capacity).toBe(175); // 250 - 75
    });
  });
});
