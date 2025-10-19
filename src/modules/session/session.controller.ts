import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('active')
  async getActiveSessions(@Request() req) {
    const sessions = await this.sessionService.getActiveSessions(
      req.user.userId,
    );
    return { count: sessions.length, sessions };
  }

  @Get('history')
  async getSessionHistory(@Request() req) {
    const sessions = await this.sessionService.getRecentSessions(
      req.user.userId,
      20,
    );
    return { count: sessions.length, sessions };
  }

  @Delete(':id')
  async terminateSession(@Param('id') sessionId: string) {
    await this.sessionService.terminateSession(sessionId);
    return { message: 'Session terminated successfully' };
  }

  @Get('concurrent-check')
  async checkConcurrentSessions(@Request() req) {
    const count = await this.sessionService.getConcurrentSessionCount(
      req.user.userId,
    );
    return {
      currentSessions: count,
      message:
        count > 2 ? 'Multiple concurrent sessions detected' : 'Normal usage',
    };
  }
}
