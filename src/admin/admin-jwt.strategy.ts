import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminAuthService } from './admin-auth.service';

interface AdminJwtPayload {
  email: string;
  sub: string;
  type: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private adminAuthService: AdminAuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ADMIN_SECRET || 'admin-access-secret-key',
    });
  }

  async validate(payload: AdminJwtPayload) {
    // Ensure this is an admin token
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Not an admin token');
    }

    const admin = await this.adminAuthService.validateAdmin(payload.sub);

    if (!admin) {
      throw new UnauthorizedException();
    }

    return admin;
  }
}
