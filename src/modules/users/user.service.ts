import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, SubscriptionTier } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: {
    email: string;
    passwordHash: string;
    subscriptionTier?: SubscriptionTier;
  }): Promise<User> {
    const user = this.userRepository.create({
      email: data.email,
      passwordHash: data.passwordHash,
      subscriptionTier: data.subscriptionTier || SubscriptionTier.FREE,
      maxDevicesAllowed: this.getMaxDevices(data.subscriptionTier),
      maxConcurrentSessions: this.getMaxSessions(data.subscriptionTier),
    });

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  async updateRiskScore(userId: string, riskScore: number): Promise<void> {
    await this.userRepository.update(userId, {
      riskScore,
    });
  }

  private getMaxDevices(tier?: SubscriptionTier): number {
    switch (tier) {
      case SubscriptionTier.ENTERPRISE:
        return 10;
      case SubscriptionTier.PREMIUM:
        return 5;
      case SubscriptionTier.BASIC:
        return 3;
      default:
        return 2;
    }
  }

  private getMaxSessions(tier?: SubscriptionTier): number {
    switch (tier) {
      case SubscriptionTier.ENTERPRISE:
        return 5;
      case SubscriptionTier.PREMIUM:
        return 3;
      case SubscriptionTier.BASIC:
        return 2;
      default:
        return 1;
    }
  }
}
