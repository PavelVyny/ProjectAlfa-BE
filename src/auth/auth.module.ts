import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { ProtectedController } from './protected.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [PassportModule, FirebaseModule],
  controllers: [AuthController, ProtectedController],
  providers: [
    AuthService,
    GoogleAuthService,
    JwtService,
    RefreshTokenService,
    JwtStrategy,
    PrismaService,
  ],
  exports: [AuthService, JwtService],
})
export class AuthModule {}
