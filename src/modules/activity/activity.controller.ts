import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { ActivityType } from './entities/activity-log.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

class TrackActivityDto {
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('track')
  async trackActivity(@Body() dto: TrackActivityDto, @Request() req) {
    const activity = await this.activityService.trackActivity({
      userId: req.user.userId,
      sessionId: req.user.sessionId,
      activityType: dto.activityType,
      metadata: dto.metadata,
    });

    return {
      message: 'Activity tracked successfully',
      activity,
    };
  }

  @Get('history')
  async getActivityHistory(@Request() req, @Query('limit') limit?: string) {
    const activities = await this.activityService.getUserActivities(
      req.user.userId,
      limit ? parseInt(limit) : 50,
    );

    return {
      count: activities.length,
      activities,
    };
  }
}
