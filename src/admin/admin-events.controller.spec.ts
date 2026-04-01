import { Test, TestingModule } from '@nestjs/testing';
import { AdminEventsController } from './admin-events.controller';
import { EventsService } from '../events/events.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { EventCategory, EventStatus } from '@prisma/client';
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateEventStatusDto,
} from './dto/admin-events.dto';
import { EventsPaginatedResult } from '../events/events.service';

// Bypass guard for unit tests
const mockGuard = { canActivate: () => true };

const mockEvent = {
  id: 'evt-001',
  title: 'Test Event',
  description: 'A test event',
  category: EventCategory.MUSIC,
  price: 10,
  date: new Date('2026-06-15'),
  start_time: '18:00',
  duration_minutes: 120,
  capacity: 100,
  status: EventStatus.DRAFT,
  location: 'Test Venue',
  image_url: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  remaining_capacity: 100,
};

const mockPaginatedResult: EventsPaginatedResult = {
  data: [mockEvent],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

describe('AdminEventsController', () => {
  let controller: AdminEventsController;
  let mockEventsService: {
    findAllAdmin: jest.Mock;
    createEvent: jest.Mock;
    updateEvent: jest.Mock;
    deleteEvent: jest.Mock;
    updateEventStatus: jest.Mock;
  };

  beforeEach(async () => {
    mockEventsService = {
      findAllAdmin: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
      updateEventStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminEventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    })
      .overrideGuard(AdminJwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminEventsController>(AdminEventsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('calls eventsService.findAllAdmin with query and returns SuccessResponse', async () => {
      mockEventsService.findAllAdmin.mockResolvedValue(mockPaginatedResult);
      const result = await controller.findAll({});
      expect(mockEventsService.findAllAdmin).toHaveBeenCalledWith({});
      expect(result).toMatchObject({
        success: true,
        data: mockPaginatedResult,
      });
    });
  });

  describe('create', () => {
    it('calls eventsService.createEvent with dto and returns SuccessResponse', async () => {
      const dto: CreateEventDto = {
        title: 'New Event',
        description: 'Desc',
        category: EventCategory.TECH,
        price: 20,
        date: '2026-07-01',
        start_time: '10:00',
        duration_minutes: 90,
        capacity: 50,
        location: 'Tech Hub',
      };
      mockEventsService.createEvent.mockResolvedValue({ ...mockEvent, ...dto });
      const result = await controller.create(dto);
      expect(mockEventsService.createEvent).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('update', () => {
    it('calls eventsService.updateEvent with id and dto', async () => {
      const dto: UpdateEventDto = {
        title: mockEvent.title,
        description: mockEvent.description,
        category: mockEvent.category,
        price: mockEvent.price,
        date: '2026-06-15',
        start_time: mockEvent.start_time,
        duration_minutes: mockEvent.duration_minutes,
        capacity: mockEvent.capacity,
        location: mockEvent.location,
      };
      mockEventsService.updateEvent.mockResolvedValue(mockEvent);
      const result = await controller.update('evt-001', dto);
      expect(mockEventsService.updateEvent).toHaveBeenCalledWith(
        'evt-001',
        dto,
      );
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('remove', () => {
    it('calls eventsService.deleteEvent with id and returns SuccessResponse', async () => {
      mockEventsService.deleteEvent.mockResolvedValue(undefined);
      const result = await controller.remove('evt-001');
      expect(mockEventsService.deleteEvent).toHaveBeenCalledWith('evt-001');
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('updateStatus', () => {
    it('calls eventsService.updateEventStatus with id and dto', async () => {
      const dto: UpdateEventStatusDto = { status: EventStatus.PUBLISHED };
      mockEventsService.updateEventStatus.mockResolvedValue({
        ...mockEvent,
        status: EventStatus.PUBLISHED,
      });
      const result = await controller.updateStatus('evt-001', dto);
      expect(mockEventsService.updateEventStatus).toHaveBeenCalledWith(
        'evt-001',
        dto,
      );
      expect(result).toMatchObject({ success: true });
    });
  });
});
