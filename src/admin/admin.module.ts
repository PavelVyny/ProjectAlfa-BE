import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtService } from './admin-jwt.service';
import { AdminRefreshTokenService } from './admin-refresh-token.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'admin-jwt' })],
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    AdminJwtService,
    AdminRefreshTokenService,
    AdminJwtStrategy,
    PrismaService,
  ],
})
export class AdminModule {}
