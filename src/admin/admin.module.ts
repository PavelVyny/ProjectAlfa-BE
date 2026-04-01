import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminEventsController } from './admin-events.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtService } from './admin-jwt.service';
import { AdminRefreshTokenService } from './admin-refresh-token.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { EventsModule } from '../events/events.module'; // per D-02: provides EventsService

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    EventsModule, // provides EventsService via exports — per D-02
  ],
  controllers: [AdminAuthController, AdminEventsController],
  providers: [
    AdminAuthService,
    AdminJwtService,
    AdminRefreshTokenService,
    AdminJwtStrategy,
    PrismaService,
  ],
})
export class AdminModule {}
