import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  RiskAlert,
  AlertType,
  AlertSeverity,
} from './entities/risk-alert.entity';
import { User } from '../users/entities/user.entity';
import { Device } from '../device/entities/device.entity';
import { Session } from '../session/entities/session.entity';

interface RiskAnalysisInput {
  user: User;
  device: Device;
  session: Session;
  previousSessions: Session[];
}

interface RiskAnalysisResult {
  totalRiskScore: number;
  deviceRisk: number;
  locationRisk: number;
  behavioralRisk: number;
  sessionRisk: number;
  warnings: string[];
  alerts: RiskAlert[];
}

@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(RiskAlert)
    private readonly riskAlertRepository: Repository<RiskAlert>,
    private readonly configService: ConfigService,
  ) {}

  async analyzeLoginRisk(
    input: RiskAnalysisInput,
  ): Promise<RiskAnalysisResult> {
    const deviceRisk = this.calculateDeviceRisk(input.device, input.user);
    const locationRisk = this.calculateLocationRisk(
      input.session,
      input.previousSessions,
    );
    const behavioralRisk = this.calculateBehavioralRisk(
      input.user,
      input.previousSessions,
    );
    const sessionRisk = this.calculateSessionRisk(
      input.user,
      input.previousSessions,
    );

    // Weighted risk calculation
    const totalRiskScore =
      deviceRisk * 0.3 +
      locationRisk * 0.25 +
      behavioralRisk * 0.25 +
      sessionRisk * 0.2;

    const warnings: string[] = [];
    const alerts: RiskAlert[] = [];

    // Generate alerts based on risk thresholds
    if (
      totalRiskScore >= this.configService.get('CRITICAL_RISK_THRESHOLD', 80)
    ) {
      warnings.push('Critical risk detected. Account may be suspended.');
      const alert = await this.createAlert({
        userId: input.user.id,
        alertType: AlertType.HIGH_RISK_SCORE,
        severity: AlertSeverity.CRITICAL,
        description: `Critical risk score: ${totalRiskScore.toFixed(2)}`,
        metadata: {
          totalRiskScore,
          deviceRisk,
          locationRisk,
          behavioralRisk,
          sessionRisk,
        },
      });
      alerts.push(alert);
    } else if (
      totalRiskScore >= this.configService.get('HIGH_RISK_THRESHOLD', 60)
    ) {
      warnings.push('High risk detected. Please verify your identity.');
      const alert = await this.createAlert({
        userId: input.user.id,
        alertType: AlertType.HIGH_RISK_SCORE,
        severity: AlertSeverity.HIGH,
        description: `High risk score: ${totalRiskScore.toFixed(2)}`,
        metadata: { totalRiskScore },
      });
      alerts.push(alert);
    }

    // Device-specific alerts
    if (deviceRisk > 70 && !input.device.isTrusted) {
      warnings.push('Suspicious device detected.');
      const alert = await this.createAlert({
        userId: input.user.id,
        alertType: AlertType.SUSPICIOUS_DEVICE,
        severity: AlertSeverity.HIGH,
        description: 'Login from suspicious or unknown device',
        metadata: { deviceId: input.device.id, deviceRisk },
      });
      alerts.push(alert);
    }

    // Location-specific alerts
    if (locationRisk > 80) {
      warnings.push('Impossible travel detected.');
      const alert = await this.createAlert({
        userId: input.user.id,
        alertType: AlertType.IMPOSSIBLE_TRAVEL,
        severity: AlertSeverity.CRITICAL,
        description:
          'Physical travel between locations is impossible in given timeframe',
        metadata: { locationRisk, sessionId: input.session.id },
      });
      alerts.push(alert);
    }

    // Session-specific alerts
    if (sessionRisk > 60) {
      warnings.push('Multiple concurrent sessions detected.');
      const alert = await this.createAlert({
        userId: input.user.id,
        alertType: AlertType.CONCURRENT_SESSIONS,
        severity: AlertSeverity.MEDIUM,
        description: 'Account accessed from multiple locations simultaneously',
        metadata: { activeSessions: input.previousSessions.length + 1 },
      });
      alerts.push(alert);
    }

    return {
      totalRiskScore: parseFloat(totalRiskScore.toFixed(2)),
      deviceRisk: parseFloat(deviceRisk.toFixed(2)),
      locationRisk: parseFloat(locationRisk.toFixed(2)),
      behavioralRisk: parseFloat(behavioralRisk.toFixed(2)),
      sessionRisk: parseFloat(sessionRisk.toFixed(2)),
      warnings,
      alerts,
    };
  }

  private calculateDeviceRisk(device: Device, _user: User): number {
    let risk = 0;

    // New device adds risk
    const deviceAge = Date.now() - device.firstSeenAt.getTime();
    const isNewDevice = deviceAge < 24 * 60 * 60 * 1000; // Less than 24 hours

    if (isNewDevice) {
      risk += 40;
    }

    // Low trust score increases risk
    const trustScore = parseFloat(device.trustScore.toString());
    if (trustScore < 30) {
      risk += 50;
    } else if (trustScore < 50) {
      risk += 30;
    } else if (trustScore < 70) {
      risk += 15;
    }

    // Untrusted device adds risk
    if (!device.isTrusted) {
      risk += 20;
    }

    return Math.min(risk, 100);
  }

  private calculateLocationRisk(
    currentSession: Session,
    previousSessions: Session[],
  ): number {
    let risk = 0;

    if (!currentSession.location || !currentSession.location.latitude) {
      return 20; // Unknown location adds moderate risk
    }

    // Check for impossible travel
    const recentSessions = previousSessions
      .filter((s) => s.location && s.location.latitude)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 5);

    for (const previousSession of recentSessions) {
      const distance = this.calculateDistance(
        currentSession.location.latitude || 0,
        currentSession.location.longitude!,
        previousSession.location.latitude || 0,
        previousSession.location.longitude || 0,
      );

      const timeDiff =
        (currentSession.startedAt.getTime() -
          previousSession.startedAt.getTime()) /
        (1000 * 60 * 60); // hours

      if (timeDiff > 0) {
        const speed = distance / timeDiff; // km/h

        const impossibleSpeed = this.configService.get(
          'IMPOSSIBLE_TRAVEL_SPEED_KMH',
          800,
        );

        if (speed > impossibleSpeed) {
          risk += 80;
          break;
        }

        // Suspicious travel (very fast but possible with flights)
        if (speed > 500) {
          risk += 40;
        }
      }
    }

    // Multiple different countries in short time
    const recentCountries = new Set(
      recentSessions
        .filter(
          (s) => s.startedAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
        )
        .map((s) => s.location?.country)
        .filter(Boolean),
    );

    if (recentCountries.size > 3) {
      risk += 30;
    }

    return Math.min(risk, 100);
  }

  private calculateBehavioralRisk(
    _user: User,
    previousSessions: Session[],
  ): number {
    let risk = 0;

    // Rapid device switching
    const recentSessions = previousSessions
      .filter((s) => s.startedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const uniqueDevices = new Set(recentSessions.map((s) => s.deviceId));

    if (uniqueDevices.size > 5) {
      risk += 60;
    } else if (uniqueDevices.size > 3) {
      risk += 30;
    }

    // Unusual login patterns (future enhancement: ML-based)
    const loginHours = previousSessions.map((s) => s.startedAt.getHours());
    const avgLoginHour =
      loginHours.reduce((a, b) => a + b, 0) / loginHours.length;

    const currentHour = new Date().getHours();
    const hourDiff = Math.abs(currentHour - avgLoginHour);

    if (hourDiff > 8) {
      risk += 20;
    }

    return Math.min(risk, 100);
  }

  private calculateSessionRisk(user: User, activeSessions: Session[]): number {
    let risk = 0;

    // Too many concurrent sessions
    const sessionCount = activeSessions.length;

    if (sessionCount >= user.maxConcurrentSessions) {
      risk += 50;
    }

    if (sessionCount > user.maxConcurrentSessions + 2) {
      risk += 30;
    }

    // Sessions from multiple locations simultaneously
    const activeLocations = new Set(
      activeSessions.map((s) => s.location?.country).filter(Boolean),
    );

    if (activeLocations.size > 2) {
      risk += 40;
    } else if (activeLocations.size > 1) {
      risk += 20;
    }

    return Math.min(risk, 100);
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    // Haversine formula for distance between two points on Earth
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async createAlert(data: {
    userId: string;
    alertType: AlertType;
    severity: AlertSeverity;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<RiskAlert> {
    const alert = this.riskAlertRepository.create(data);
    return this.riskAlertRepository.save(alert);
  }

  async getAlerts(
    userId: string,
    unresolvedOnly = false,
  ): Promise<RiskAlert[]> {
    const query = this.riskAlertRepository
      .createQueryBuilder('alert')
      .where('alert.userId = :userId', { userId })
      .orderBy('alert.createdAt', 'DESC');

    if (unresolvedOnly) {
      query.andWhere('alert.isResolved = :isResolved', { isResolved: false });
    }

    return query.getMany();
  }

  async resolveAlert(alertId: string): Promise<RiskAlert> {
    const alert = await this.riskAlertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.isResolved = true;
    alert.resolvedAt = new Date();

    return this.riskAlertRepository.save(alert);
  }

  async calculateUserRiskScore(userId: string): Promise<number> {
    const recentAlerts = await this.riskAlertRepository
      .createQueryBuilder('alert')
      .where('alert.userId = :userId', { userId })
      .andWhere('alert.isResolved = :isResolved', { isResolved: false })
      .andWhere('alert.createdAt > :since', {
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      })
      .getMany();

    let score = 0;

    for (const alert of recentAlerts) {
      switch (alert.severity) {
        case AlertSeverity.CRITICAL:
          score += 25;
          break;
        case AlertSeverity.HIGH:
          score += 15;
          break;
        case AlertSeverity.MEDIUM:
          score += 8;
          break;
        case AlertSeverity.LOW:
          score += 3;
          break;
      }
    }

    return Math.min(score, 100);
  }
}
