import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityType } from './entities/activity-log.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
  ) {}

  async trackActivity(data: {
    userId: string;
    sessionId: string;
    activityType: ActivityType;
    metadata?: Record<string, any>;
  }): Promise<ActivityLog> {
    const activity = this.activityRepository.create(data);
    return this.activityRepository.save(activity);
  }

  async getUserActivities(userId: string, limit = 50): Promise<ActivityLog[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getSessionActivities(sessionId: string): Promise<ActivityLog[]> {
    return this.activityRepository.find({
      where: { sessionId },
      order: { timestamp: 'DESC' },
    });
  }
}
