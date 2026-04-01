import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [], // No PrismaModule exists — PrismaService is a direct provider
  controllers: [EventsController],
  providers: [EventsService, PrismaService],
})
export class EventsModule {}
