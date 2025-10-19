import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RiskService } from './risk.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('score')
  async getRiskScore(@Request() req) {
    const score = await this.riskService.calculateUserRiskScore(
      req.user.userId,
    );
    return {
      userId: req.user.userId,
      riskScore: score,
      timestamp: new Date(),
    };
  }

  @Get('alerts')
  async getAlerts(
    @Request() req,
    @Query('unresolved') unresolvedOnly?: string,
  ) {
    const unresolved = unresolvedOnly === 'true';
    const alerts = await this.riskService.getAlerts(
      req.user.userId,
      unresolved,
    );

    return {
      count: alerts.length,
      alerts,
    };
  }

  @Post('alerts/:alertId/resolve')
  async resolveAlert(@Param('alertId') alertId: string) {
    const alert = await this.riskService.resolveAlert(alertId);
    return {
      message: 'Alert resolved successfully',
      alert,
    };
  }
}
