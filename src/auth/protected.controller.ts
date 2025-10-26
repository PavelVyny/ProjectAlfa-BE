import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedUser {
  id: string;
  email: string;
  nickname?: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('protected')
export class ProtectedController {
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: AuthenticatedRequest) {
    return {
      message: 'This is a protected route',
      user: {
        id: req.user.id,
        email: req.user.email,
        nickname: req.user.nickname,
      },
    };
  }
}
