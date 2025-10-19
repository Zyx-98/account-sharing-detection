import dataSource from 'data-source';
import {
  User,
  SubscriptionTier,
  AccountStatus,
} from '../../modules/users/entities/user.entity';

import {
  ActivityLog,
  ActivityType,
} from '../../modules/activity/entities/activity-log.entity';
import {
  RiskAlert,
  AlertType,
  AlertSeverity,
} from '../../modules/risk/entities/risk-alert.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Device, DeviceType } from 'src/modules/device/entities/device.entity';
import { Session } from 'src/modules/session/entities/session.entity';

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Initialize data source
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    // Get repositories
    const userRepository = dataSource.getRepository(User);
    const deviceRepository = dataSource.getRepository(Device);
    const sessionRepository = dataSource.getRepository(Session);
    const activityRepository = dataSource.getRepository(ActivityLog);
    const alertRepository = dataSource.getRepository(RiskAlert);

    // Clear existing data (in correct order due to foreign keys)
    console.log('🗑️  Clearing existing data...');
    await activityRepository.delete({});
    await alertRepository.delete({});
    await sessionRepository.delete({});
    await deviceRepository.delete({});
    await userRepository.delete({});

    // Hash password once for all test users
    const passwordHash = await bcrypt.hash('Test123!@#', 12);

    // ==========================================
    // 1. Create Test Users
    // ==========================================
    console.log('👤 Creating users...');

    const freeUser = userRepository.create({
      email: 'free@example.com',
      passwordHash,
      subscriptionTier: SubscriptionTier.FREE,
      maxDevicesAllowed: 2,
      maxConcurrentSessions: 1,
      accountStatus: AccountStatus.ACTIVE,
      riskScore: 15,
      lastLoginAt: new Date(),
    });

    const basicUser = userRepository.create({
      email: 'basic@example.com',
      passwordHash,
      subscriptionTier: SubscriptionTier.BASIC,
      maxDevicesAllowed: 3,
      maxConcurrentSessions: 2,
      accountStatus: AccountStatus.ACTIVE,
      riskScore: 25,
      lastLoginAt: new Date(),
    });

    const premiumUser = userRepository.create({
      email: 'premium@example.com',
      passwordHash,
      subscriptionTier: SubscriptionTier.PREMIUM,
      maxDevicesAllowed: 5,
      maxConcurrentSessions: 3,
      accountStatus: AccountStatus.ACTIVE,
      riskScore: 10,
      lastLoginAt: new Date(),
    });

    const enterpriseUser = userRepository.create({
      email: 'enterprise@example.com',
      passwordHash,
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      maxDevicesAllowed: 10,
      maxConcurrentSessions: 5,
      accountStatus: AccountStatus.ACTIVE,
      riskScore: 5,
      lastLoginAt: new Date(),
    });

    const suspiciousUser = userRepository.create({
      email: 'suspicious@example.com',
      passwordHash,
      subscriptionTier: SubscriptionTier.BASIC,
      maxDevicesAllowed: 3,
      maxConcurrentSessions: 2,
      accountStatus: AccountStatus.ACTIVE,
      riskScore: 85,
      lastLoginAt: new Date(),
    });

    const suspendedUser = userRepository.create({
      email: 'suspended@example.com',
      passwordHash,
      subscriptionTier: SubscriptionTier.FREE,
      maxDevicesAllowed: 2,
      maxConcurrentSessions: 1,
      accountStatus: AccountStatus.SUSPENDED,
      riskScore: 95,
      lastLoginAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    });

    await userRepository.save([
      freeUser,
      basicUser,
      premiumUser,
      enterpriseUser,
      suspiciousUser,
      suspendedUser,
    ]);

    console.log('✅ Created 6 users');

    // ==========================================
    // 2. Create Devices
    // ==========================================
    console.log('📱 Creating devices...');

    // Premium user devices (normal usage)
    const premiumDevices = [
      deviceRepository.create({
        userId: premiumUser.id,
        fingerprintHash: generateHash('MacBook-Pro-Chrome'),
        deviceName: 'MacBook Pro - Chrome',
        deviceType: DeviceType.WEB,
        trustScore: 95,
        isTrusted: true,
        metadata: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          screenResolution: '1920x1080',
          timezone: 'America/New_York',
          language: 'en-US',
          platform: 'MacIntel',
        },
        firstSeenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
      }),
      deviceRepository.create({
        userId: premiumUser.id,
        fingerprintHash: generateHash('iPhone-Safari'),
        deviceName: 'iPhone 14 - Safari',
        deviceType: DeviceType.MOBILE,
        trustScore: 90,
        isTrusted: true,
        metadata: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          screenResolution: '1170x2532',
          timezone: 'America/New_York',
          language: 'en-US',
        },
        firstSeenAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }),
    ];

    // Suspicious user devices (account sharing indicators)
    const suspiciousDevices = [
      deviceRepository.create({
        userId: suspiciousUser.id,
        fingerprintHash: generateHash('Device-NYC'),
        deviceName: 'Windows PC - New York',
        deviceType: DeviceType.WEB,
        trustScore: 45,
        isTrusted: false,
        metadata: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          screenResolution: '1920x1080',
          timezone: 'America/New_York',
        },
        firstSeenAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
      }),
      deviceRepository.create({
        userId: suspiciousUser.id,
        fingerprintHash: generateHash('Device-London'),
        deviceName: 'MacBook - London',
        deviceType: DeviceType.WEB,
        trustScore: 30,
        isTrusted: false,
        metadata: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          timezone: 'Europe/London',
        },
        firstSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }),
      deviceRepository.create({
        userId: suspiciousUser.id,
        fingerprintHash: generateHash('Device-Tokyo'),
        deviceName: 'Android - Tokyo',
        deviceType: DeviceType.MOBILE,
        trustScore: 25,
        isTrusted: false,
        metadata: {
          userAgent: 'Mozilla/5.0 (Linux; Android 12)',
          timezone: 'Asia/Tokyo',
        },
        firstSeenAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(Date.now() - 30 * 60 * 1000),
      }),
    ];

    // Basic user devices
    const basicDevices = [
      deviceRepository.create({
        userId: basicUser.id,
        fingerprintHash: generateHash('Basic-Laptop'),
        deviceName: 'Dell Laptop - Chrome',
        deviceType: DeviceType.WEB,
        trustScore: 80,
        isTrusted: true,
        metadata: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        firstSeenAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
      }),
    ];

    await deviceRepository.save([
      ...premiumDevices,
      ...suspiciousDevices,
      ...basicDevices,
    ]);

    console.log('✅ Created devices');

    // ==========================================
    // 3. Create Sessions
    // ==========================================
    console.log('🔐 Creating sessions...');

    const premiumSessions = [
      sessionRepository.create({
        userId: premiumUser.id,
        deviceId: premiumDevices[0].id,
        ipAddress: '192.168.1.100',
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          city: 'New York',
          country: 'USA',
          countryCode: 'US',
        },
        userAgent: premiumDevices[0].metadata.userAgent,
        isActive: true,
        riskScore: 5,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
      }),
    ];

    // Suspicious sessions (concurrent from different locations)
    const suspiciousSessions = [
      sessionRepository.create({
        userId: suspiciousUser.id,
        deviceId: suspiciousDevices[0].id,
        ipAddress: '192.168.1.50',
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          city: 'New York',
          country: 'USA',
          countryCode: 'US',
        },
        isActive: true,
        riskScore: 30,
        startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        lastActivityAt: new Date(Date.now() - 10 * 60 * 1000),
      }),
      sessionRepository.create({
        userId: suspiciousUser.id,
        deviceId: suspiciousDevices[1].id,
        ipAddress: '82.45.123.89',
        location: {
          latitude: 51.5074,
          longitude: -0.1278,
          city: 'London',
          country: 'United Kingdom',
          countryCode: 'GB',
        },
        isActive: true,
        riskScore: 65,
        startedAt: new Date(Date.now() - 45 * 60 * 1000),
        lastActivityAt: new Date(Date.now() - 5 * 60 * 1000),
      }),
      sessionRepository.create({
        userId: suspiciousUser.id,
        deviceId: suspiciousDevices[2].id,
        ipAddress: '210.123.45.67',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          city: 'Tokyo',
          country: 'Japan',
          countryCode: 'JP',
        },
        isActive: true,
        riskScore: 85,
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        lastActivityAt: new Date(),
      }),
    ];

    await sessionRepository.save([...premiumSessions, ...suspiciousSessions]);

    console.log('✅ Created sessions');

    // ==========================================
    // 4. Create Activity Logs
    // ==========================================
    console.log('📊 Creating activity logs...');

    const activities = [
      // Premium user activities (normal)
      activityRepository.create({
        userId: premiumUser.id,
        sessionId: premiumSessions[0].id,
        activityType: ActivityType.LOGIN,
        metadata: { loginMethod: 'password' },
        riskScore: 0,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }),
      activityRepository.create({
        userId: premiumUser.id,
        sessionId: premiumSessions[0].id,
        activityType: ActivityType.COURSE_VIEW,
        metadata: { courseId: '101', courseName: 'Advanced JavaScript' },
        riskScore: 0,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }),
      activityRepository.create({
        userId: premiumUser.id,
        sessionId: premiumSessions[0].id,
        activityType: ActivityType.VIDEO_WATCH,
        metadata: { videoId: '505', duration: 1800 },
        riskScore: 0,
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      }),

      // Suspicious user activities (rapid switching)
      activityRepository.create({
        userId: suspiciousUser.id,
        sessionId: suspiciousSessions[0].id,
        activityType: ActivityType.LOGIN,
        metadata: { location: 'New York' },
        riskScore: 30,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }),
      activityRepository.create({
        userId: suspiciousUser.id,
        sessionId: suspiciousSessions[1].id,
        activityType: ActivityType.LOGIN,
        metadata: { location: 'London' },
        riskScore: 65,
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
      }),
      activityRepository.create({
        userId: suspiciousUser.id,
        sessionId: suspiciousSessions[2].id,
        activityType: ActivityType.LOGIN,
        metadata: { location: 'Tokyo' },
        riskScore: 85,
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      }),
    ];

    await activityRepository.save(activities);

    console.log('✅ Created activity logs');

    // ==========================================
    // 5. Create Risk Alerts
    // ==========================================
    console.log('🚨 Creating risk alerts...');

    const alerts = [
      // Suspicious user alerts
      alertRepository.create({
        userId: suspiciousUser.id,
        alertType: AlertType.CONCURRENT_SESSIONS,
        severity: AlertSeverity.HIGH,
        description:
          'Multiple concurrent sessions detected from different countries',
        metadata: {
          sessionCount: 3,
          locations: ['New York', 'London', 'Tokyo'],
        },
        isResolved: false,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      }),
      alertRepository.create({
        userId: suspiciousUser.id,
        alertType: AlertType.IMPOSSIBLE_TRAVEL,
        severity: AlertSeverity.CRITICAL,
        description:
          'Impossible travel detected: New York to Tokyo in 45 minutes',
        metadata: {
          distance: 10850,
          timeElapsed: 45,
          speed: 14466,
        },
        isResolved: false,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      }),
      alertRepository.create({
        userId: suspiciousUser.id,
        alertType: AlertType.SUSPICIOUS_DEVICE,
        severity: AlertSeverity.MEDIUM,
        description: 'Login from new untrusted device',
        metadata: {
          deviceId: suspiciousDevices[2].id,
          deviceType: 'mobile',
          location: 'Tokyo',
        },
        isResolved: false,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      }),

      // Suspended user alerts (historical)
      alertRepository.create({
        userId: suspendedUser.id,
        alertType: AlertType.HIGH_RISK_SCORE,
        severity: AlertSeverity.CRITICAL,
        description: 'Account risk score exceeded critical threshold (95)',
        metadata: { riskScore: 95 },
        isResolved: true,
        resolvedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      }),
    ];

    await alertRepository.save(alerts);

    console.log('✅ Created risk alerts');

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👤 Users: ${await userRepository.count()}`);
    console.log(`   📱 Devices: ${await deviceRepository.count()}`);
    console.log(`   🔐 Sessions: ${await sessionRepository.count()}`);
    console.log(`   📊 Activities: ${await activityRepository.count()}`);
    console.log(`   🚨 Alerts: ${await alertRepository.count()}`);

    console.log('\n🔑 Test Credentials:');
    console.log('   Email: free@example.com | Password: Test123!@#');
    console.log('   Email: basic@example.com | Password: Test123!@#');
    console.log('   Email: premium@example.com | Password: Test123!@#');
    console.log('   Email: enterprise@example.com | Password: Test123!@#');
    console.log(
      '   Email: suspicious@example.com | Password: Test123!@# (⚠️ High risk)',
    );
    console.log(
      '   Email: suspended@example.com | Password: Test123!@# (🚫 Suspended)',
    );
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('\n✅ Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed failed:', error);
      process.exit(1);
    });
}

export default seed;
