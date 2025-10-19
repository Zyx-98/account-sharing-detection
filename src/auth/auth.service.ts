import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SessionService } from 'src/modules/session/session.service';
import { DeviceService } from 'src/modules/device/device.service';
import { UserService } from 'src/modules/users/user.service';
import { RiskService } from 'src/modules/risk/risk.service';
import { AccountStatus, User } from 'src/modules/users/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly deviceService: DeviceService,
    private readonly sessionService: SessionService,
    private readonly riskService: RiskService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const existingUser = await this.userService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(
      registerDto.password,
      parseInt(process.env.BCRYPT_ROUNDS || '12'),
    );

    return this.userService.create({
      ...registerDto,
      passwordHash,
    });
  }

  async login(loginDto: LoginDto, ipAddress: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException(
        `Account is ${user.accountStatus}. Please contact support.`,
      );
    }

    // Register or identify device
    const device = await this.deviceService.registerDevice(
      user.id,
      loginDto.deviceFingerprint,
    );

    // Check concurrent sessions
    const activeSessions = await this.sessionService.getActiveSessions(user.id);
    const concurrentWarning =
      activeSessions.length >= user.maxConcurrentSessions
        ? 'Maximum concurrent sessions reached. Oldest session will be terminated.'
        : null;

    // Terminate oldest session if limit exceeded
    if (activeSessions.length >= user.maxConcurrentSessions) {
      const oldestSession = activeSessions.sort(
        (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
      )[0];
      await this.sessionService.terminateSession(oldestSession.id);
    }

    // Create new session
    const session = await this.sessionService.createSession({
      userId: user.id,
      deviceId: device.id,
      ipAddress,
      location: loginDto.location,
      userAgent: loginDto.deviceFingerprint.userAgent,
    });

    // Perform risk analysis
    const riskAnalysis = await this.riskService.analyzeLoginRisk({
      user,
      device,
      session,
      previousSessions: activeSessions,
    });

    // Update user's last login
    await this.userService.updateLastLogin(user.id);

    // Generate JWT token
    const accessToken = this.generateAccessToken(user, session.id);

    return {
      accessToken,
      user: this.sanitizeUser(user),
      device: {
        id: device.id,
        isNew: device.firstSeenAt.getTime() === device.lastSeenAt.getTime(),
        isTrusted: device.isTrusted,
        trustScore: parseFloat(device.trustScore.toString()),
      },
      riskScore: riskAnalysis.totalRiskScore,
      warnings: riskAnalysis.warnings.concat(
        concurrentWarning ? [concurrentWarning] : [],
      ),
      alerts: riskAnalysis.alerts,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  generateAccessToken(user: User, sessionId: string): string {
    const payload = {
      sub: user.id,
      email: user.email,
      sessionId,
    };

    return this.jwtService.sign(payload);
  }

  async logout(_userId: string, sessionId: string): Promise<void> {
    await this.sessionService.terminateSession(sessionId);
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
