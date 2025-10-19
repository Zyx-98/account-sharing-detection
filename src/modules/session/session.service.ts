import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';

interface CreateSessionDto {
  userId: string;
  deviceId: string;
  ipAddress: string;
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    countryCode?: string;
  };
  userAgent?: string;
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async createSession(data: CreateSessionDto): Promise<Session> {
    const session = this.sessionRepository.create({
      userId: data.userId,
      deviceId: data.deviceId,
      ipAddress: data.ipAddress,
      location: data.location,
      userAgent: data.userAgent,
      isActive: true,
      lastActivityAt: new Date(),
    });

    return this.sessionRepository.save(session);
  }

  async getActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        startedAt: 'DESC',
      },
      relations: ['device'],
    });
  }

  async getSessionById(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['device', 'user'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.isActive = false;
    session.endedAt = new Date();

    await this.sessionRepository.save(session);
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      lastActivityAt: new Date(),
    });
  }

  async terminateInactiveSessions(): Promise<void> {
    const inactiveThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    await this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({
        isActive: false,
        endedAt: new Date(),
      })
      .where('isActive = :isActive', { isActive: true })
      .andWhere('lastActivityAt < :threshold', { threshold: inactiveThreshold })
      .execute();
  }

  async getConcurrentSessionCount(userId: string): Promise<number> {
    return this.sessionRepository.count({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  async getRecentSessions(userId: string, limit = 10): Promise<Session[]> {
    return this.sessionRepository.find({
      where: { userId },
      order: { startedAt: 'DESC' },
      take: limit,
      relations: ['device'],
    });
  }
}
