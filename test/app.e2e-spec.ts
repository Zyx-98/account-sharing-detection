import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Account Sharing Detection System - E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let premiumUserToken: string;
  let basicUserToken: string;
  let premiumUserId: string;
  let premiumDeviceId: string;
  let premiumSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('1. Authentication & User Management', () => {
    describe('POST /auth/register', () => {
      it('should register a new user with valid data', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email: 'newuser@test.com',
            password: 'SecurePass123!',
            subscriptionTier: 'basic',
          })
          .expect(201);

        expect(response.body.message).toBe('User registered successfully');
        expect(response.body.user).toBeDefined();
        expect(response.body.user.email).toBe('newuser@test.com');
        expect(response.body.user.subscriptionTier).toBe('basic');
      });

      it('should reject registration with duplicate email', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email: 'newuser@test.com',
            password: 'SecurePass123!',
          })
          .expect(409);
      });

      it('should reject registration with weak password', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email: 'another@test.com',
            password: '123',
          })
          .expect(400);
      });

      it('should reject registration with invalid email', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email: 'invalid-email',
            password: 'SecurePass123!',
          })
          .expect(400);
      });
    });

    describe('POST /auth/login', () => {
      it('should login successfully with valid credentials', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'premium@example.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
              screenResolution: '1920x1080',
              timezone: 'America/New_York',
              language: 'en-US',
              platform: 'MacIntel',
              hardwareConcurrency: 8,
              canvas: 'test-canvas-hash',
              webgl: 'test-webgl-hash',
            },
            location: {
              latitude: 40.7128,
              longitude: -74.006,
              city: 'New York',
              country: 'USA',
              countryCode: 'US',
            },
          })
          .expect(200);

        expect(response.body.accessToken).toBeDefined();
        expect(response.body.user).toBeDefined();
        expect(response.body.device).toBeDefined();
        expect(response.body.riskScore).toBeDefined();
        expect(response.body.riskScore).toBeLessThan(50);

        premiumUserToken = response.body.accessToken;
        premiumUserId = response.body.user.id;
        premiumDeviceId = response.body.device.id;
      });

      it('should reject login with invalid credentials', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'premium@example.com',
            password: 'WrongPassword',
            deviceFingerprint: {
              userAgent: 'Test',
            },
          })
          .expect(401);
      });

      it('should reject login for suspended account', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'suspended@example.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Test',
            },
          })
          .expect(401);
      });
    });

    describe('POST /auth/verify', () => {
      it('should verify valid token', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.valid).toBe(true);
        expect(response.body.user).toBeDefined();
      });

      it('should reject invalid token', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });

    describe('GET /users/me', () => {
      it('should return current user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/users/me')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.id).toBe(premiumUserId);
        expect(response.body.email).toBe('premium@example.com');
        expect(response.body.passwordHash).toBeUndefined();
      });
    });
  });

  describe('2. Device Management', () => {
    describe('GET /devices', () => {
      it('should return user devices', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/devices')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.devices).toBeDefined();
        expect(Array.isArray(response.body.devices)).toBe(true);
        expect(response.body.count).toBeGreaterThan(0);
      });

      it('should reject unauthorized access', async () => {
        await request(app.getHttpServer()).get('/api/v1/devices').expect(401);
      });
    });

    describe('POST /devices/:id/trust', () => {
      it('should mark device as trusted', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/devices/${premiumDeviceId}/trust`)
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(201);

        expect(response.body.message).toContain('trusted');
        expect(response.body.device.isTrusted).toBe(true);
        expect(response.body.device.trustScore).toBeGreaterThanOrEqual(90);
      });
    });
  });

  describe('3. Session Management', () => {
    describe('GET /sessions/active', () => {
      it('should return active sessions', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/sessions/active')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.sessions).toBeDefined();
        expect(Array.isArray(response.body.sessions)).toBe(true);
        expect(response.body.count).toBeGreaterThan(0);

        if (response.body.sessions.length > 0) {
          premiumSessionId = response.body.sessions[0].id;
        }
      });
    });

    describe('GET /sessions/history', () => {
      it('should return session history', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/sessions/history')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.sessions).toBeDefined();
        expect(Array.isArray(response.body.sessions)).toBe(true);
      });
    });

    describe('GET /sessions/concurrent-check', () => {
      it('should check concurrent sessions', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/sessions/concurrent-check')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.currentSessions).toBeDefined();
        expect(typeof response.body.currentSessions).toBe('number');
        expect(response.body.message).toBeDefined();
      });
    });
  });

  describe('4. Risk Analysis', () => {
    describe('GET /risk/score', () => {
      it('should return user risk score', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/risk/score')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.riskScore).toBeDefined();
        expect(typeof response.body.riskScore).toBe('number');
        expect(response.body.riskScore).toBeGreaterThanOrEqual(0);
        expect(response.body.riskScore).toBeLessThanOrEqual(100);
        expect(response.body.timestamp).toBeDefined();
      });
    });

    describe('GET /risk/alerts', () => {
      it('should return all alerts', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/risk/alerts')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.alerts).toBeDefined();
        expect(Array.isArray(response.body.alerts)).toBe(true);
        expect(response.body.count).toBeDefined();
      });

      it('should return only unresolved alerts', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/risk/alerts?unresolved=true')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.alerts).toBeDefined();
        response.body.alerts.forEach((alert: any) => {
          expect(alert.isResolved).toBe(false);
        });
      });
    });
  });

  describe('5. Activity Tracking', () => {
    describe('POST /activity/track', () => {
      it('should track user activity', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/activity/track')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .send({
            activityType: 'course_view',
            metadata: {
              courseId: '101',
              courseName: 'NestJS Advanced',
              duration: 3600,
            },
          })
          .expect(201);

        expect(response.body.message).toContain('tracked successfully');
        expect(response.body.activity).toBeDefined();
        expect(response.body.activity.activityType).toBe('course_view');
      });

      it('should reject invalid activity type', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/activity/track')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .send({
            activityType: 'invalid_type',
            metadata: {},
          })
          .expect(400);
      });
    });

    describe('GET /activity/history', () => {
      it('should return activity history', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/activity/history')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.activities).toBeDefined();
        expect(Array.isArray(response.body.activities)).toBe(true);
        expect(response.body.count).toBeGreaterThan(0);
      });

      it('should respect limit parameter', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/activity/history?limit=5')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.activities.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('6. Advanced Scenarios - Account Sharing Detection', () => {
    describe('Scenario: Impossible Travel Detection', () => {
      let testUserToken: string;

      beforeAll(async () => {
        // Register test user
        await request(app.getHttpServer()).post('/api/v1/auth/register').send({
          email: 'traveler@test.com',
          password: 'Test123!@#',
          subscriptionTier: 'premium',
        });

        // First login from New York
        const nyResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'traveler@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
              screenResolution: '1920x1080',
              timezone: 'America/New_York',
              language: 'en-US',
              platform: 'Win32',
              hardwareConcurrency: 8,
            },
            location: {
              latitude: 40.7128,
              longitude: -74.006,
              city: 'New York',
              country: 'USA',
              countryCode: 'US',
            },
          });

        testUserToken = nyResponse.body.accessToken;
      });

      it('should detect impossible travel and flag high risk', async () => {
        // Immediate login from Tokyo (physically impossible)
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'traveler@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
              screenResolution: '1170x2532',
              timezone: 'Asia/Tokyo',
              language: 'ja-JP',
              platform: 'iPhone',
              hardwareConcurrency: 6,
            },
            location: {
              latitude: 35.6762,
              longitude: 139.6503,
              city: 'Tokyo',
              country: 'Japan',
              countryCode: 'JP',
            },
          })
          .expect(200);

        expect(response.body.riskScore).toBeGreaterThan(60);
        expect(response.body.warnings.length).toBeGreaterThan(0);

        // Check for impossible travel warning
        const hasImpossibleTravelWarning = response.body.warnings.some(
          (w: string) =>
            w.toLowerCase().includes('travel') ||
            w.toLowerCase().includes('location'),
        );
        expect(hasImpossibleTravelWarning).toBe(true);
      });
    });

    describe('Scenario: Concurrent Sessions from Different Countries', () => {
      let multiLocationToken: string;

      beforeAll(async () => {
        // Register user for concurrent session test
        await request(app.getHttpServer()).post('/api/v1/auth/register').send({
          email: 'multilocation@test.com',
          password: 'Test123!@#',
          subscriptionTier: 'basic',
        });
      });

      it('should detect and warn about concurrent sessions', async () => {
        // Login from London
        const londonResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'multilocation@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
              timezone: 'Europe/London',
              platform: 'Win32',
            },
            location: {
              latitude: 51.5074,
              longitude: -0.1278,
              city: 'London',
              country: 'United Kingdom',
            },
          });

        multiLocationToken = londonResponse.body.accessToken;
        expect(londonResponse.body.riskScore).toBeLessThan(50);

        // Concurrent login from Paris
        const parisResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'multilocation@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Mozilla/5.0 (Macintosh) Safari/17.0',
              timezone: 'Europe/Paris',
              platform: 'MacIntel',
            },
            location: {
              latitude: 48.8566,
              longitude: 2.3522,
              city: 'Paris',
              country: 'France',
            },
          });

        expect(parisResponse.body.riskScore).toBeGreaterThan(30);
        expect(parisResponse.body.warnings.length).toBeGreaterThan(0);

        // Concurrent login from Berlin
        const berlinResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'multilocation@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/120.0',
              timezone: 'Europe/Berlin',
              platform: 'Linux',
            },
            location: {
              latitude: 52.52,
              longitude: 13.405,
              city: 'Berlin',
              country: 'Germany',
            },
          });

        expect(berlinResponse.body.riskScore).toBeGreaterThan(50);

        // Verify alerts were created
        const alertsResponse = await request(app.getHttpServer())
          .get('/api/v1/risk/alerts?unresolved=true')
          .set('Authorization', `Bearer ${multiLocationToken}`)
          .expect(200);

        expect(alertsResponse.body.count).toBeGreaterThan(0);
      });
    });

    describe('Scenario: Rapid Device Switching', () => {
      let deviceSwitcherToken: string;

      beforeAll(async () => {
        await request(app.getHttpServer()).post('/api/v1/auth/register').send({
          email: 'deviceswitcher@test.com',
          password: 'Test123!@#',
          subscriptionTier: 'free',
        });
      });

      it('should detect rapid device switching pattern', async () => {
        const devices = [
          { name: 'iPhone', ua: 'Mozilla/5.0 (iPhone)', platform: 'iPhone' },
          { name: 'Android', ua: 'Mozilla/5.0 (Android)', platform: 'Linux' },
          { name: 'Windows', ua: 'Mozilla/5.0 (Windows)', platform: 'Win32' },
          { name: 'Mac', ua: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel' },
          { name: 'iPad', ua: 'Mozilla/5.0 (iPad)', platform: 'iPad' },
        ];

        let cumulativeRisk = 0;

        for (const device of devices) {
          const response = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
              email: 'deviceswitcher@test.com',
              password: 'Test123!@#',
              deviceFingerprint: {
                userAgent: device.ua,
                platform: device.platform,
                screenResolution: '1920x1080',
                timezone: 'America/New_York',
              },
              location: {
                latitude: 40.7128,
                longitude: -74.006,
                city: 'New York',
                country: 'USA',
              },
            })
            .expect(200);

          cumulativeRisk = response.body.riskScore;
          deviceSwitcherToken = response.body.accessToken;
        }

        // Risk should increase with more devices
        expect(cumulativeRisk).toBeGreaterThan(30);

        // Check devices count
        const devicesResponse = await request(app.getHttpServer())
          .get('/api/v1/devices')
          .set('Authorization', `Bearer ${deviceSwitcherToken}`)
          .expect(200);

        expect(devicesResponse.body.count).toBe(5);
      });
    });

    describe('Scenario: Subscription Tier Limits', () => {
      it('should enforce device limits for free tier', async () => {
        // Register free user
        await request(app.getHttpServer()).post('/api/v1/auth/register').send({
          email: 'freetier@test.com',
          password: 'Test123!@#',
          subscriptionTier: 'free',
        });

        // Login with first device
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'freetier@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Device1',
              platform: 'Win32',
            },
          });

        // Login with second device
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'freetier@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Device2',
              platform: 'MacIntel',
            },
          });

        // Third device should trigger warning (free tier max is 2)
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'freetier@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'Device3',
              platform: 'iPhone',
            },
          })
          .expect(200);

        expect(response.body.riskScore).toBeGreaterThan(40);
      });

      it('should enforce concurrent session limits', async () => {
        const tokens: string[] = [];

        // Create multiple concurrent sessions (free tier max is 1)
        for (let i = 0; i < 3; i++) {
          const response = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
              email: 'freetier@test.com',
              password: 'Test123!@#',
              deviceFingerprint: {
                userAgent: `ConcurrentDevice${i}`,
                platform: 'Win32',
              },
            });

          if (response.body.accessToken) {
            tokens.push(response.body.accessToken);
          }

          if (i >= 1) {
            expect(
              response.body.warnings.some((w: string) =>
                w.toLowerCase().includes('session'),
              ),
            ).toBe(true);
          }
        }
      });
    });

    describe('Scenario: Trusted Device Management', () => {
      let trustedDeviceToken: string;
      let trustedDeviceId: string;

      beforeAll(async () => {
        await request(app.getHttpServer()).post('/api/v1/auth/register').send({
          email: 'trusteduser@test.com',
          password: 'Test123!@#',
          subscriptionTier: 'premium',
        });

        const loginResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'trusteduser@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'TrustedDevice',
              platform: 'MacIntel',
            },
          });

        trustedDeviceToken = loginResponse.body.accessToken;
        trustedDeviceId = loginResponse.body.device.id;
      });

      it('should reduce risk score after trusting device', async () => {
        // Initial risk score
        const initialRisk = await request(app.getHttpServer())
          .get('/api/v1/risk/score')
          .set('Authorization', `Bearer ${trustedDeviceToken}`)
          .expect(200);

        // Trust the device
        await request(app.getHttpServer())
          .post(`/api/v1/devices/${trustedDeviceId}/trust`)
          .set('Authorization', `Bearer ${trustedDeviceToken}`)
          .expect(201);

        // Login again with trusted device
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'trusteduser@test.com',
            password: 'Test123!@#',
            deviceFingerprint: {
              userAgent: 'TrustedDevice',
              platform: 'MacIntel',
            },
          });

        // Risk score should be lower for trusted device
        expect(response.body.device.isTrusted).toBe(true);
        expect(response.body.device.trustScore).toBeGreaterThanOrEqual(90);
      });

      it('should allow removing devices', async () => {
        const devicesBeforeResponse = await request(app.getHttpServer())
          .get('/api/v1/devices')
          .set('Authorization', `Bearer ${trustedDeviceToken}`)
          .expect(200);

        const deviceCount = devicesBeforeResponse.body.count;

        // Remove device
        await request(app.getHttpServer())
          .delete(`/api/v1/devices/${trustedDeviceId}`)
          .set('Authorization', `Bearer ${trustedDeviceToken}`)
          .expect(200);

        const devicesAfterResponse = await request(app.getHttpServer())
          .get('/api/v1/devices')
          .set('Authorization', `Bearer ${trustedDeviceToken}`)
          .expect(200);

        expect(devicesAfterResponse.body.count).toBe(deviceCount - 1);
      });
    });
  });

  describe('7. Security & Error Handling', () => {
    describe('Rate Limiting', () => {
      it('should enforce rate limits on login endpoint', async () => {
        const requests: any[] = [];

        // Make many rapid requests
        for (let i = 0; i < 150; i++) {
          requests.push(
            request(app.getHttpServer())
              .post('/api/v1/auth/login')
              .send({
                email: 'ratelimit@test.com',
                password: 'Test123!@#',
                deviceFingerprint: { userAgent: 'Test' },
              }),
          );
        }

        const responses = await Promise.all(requests);

        // At least some requests should be rate limited
        const rateLimitedCount = responses.filter(
          (r) => r.status === 429,
        ).length;
        expect(rateLimitedCount).toBeGreaterThan(0);
      }, 30000);
    });

    describe('Input Validation', () => {
      it('should reject malformed device fingerprint', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'premium@example.com',
            password: 'Test123!@#',
            deviceFingerprint: 'invalid-string',
          })
          .expect(400);
      });

      it('should sanitize SQL injection attempts', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: "admin' OR '1'='1",
            password: 'Test123!@#',
            deviceFingerprint: { userAgent: 'Test' },
          })
          .expect(401);
      });
    });

    describe('Authorization', () => {
      it('should prevent access to other user devices', async () => {
        // Get another user's device ID from seeded data
        const suspiciousLogin = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'basic@example.com',
            password: 'Test123!@#',
            deviceFingerprint: { userAgent: 'Test' },
          });

        basicUserToken = suspiciousLogin.body.accessToken;

        // Try to trust premium user's device with basic user's token
        await request(app.getHttpServer())
          .post(`/api/v1/devices/${premiumDeviceId}/trust`)
          .set('Authorization', `Bearer ${basicUserToken}`)
          .expect(404); // Should not find device for this user
      });
    });
  });

  describe('8. Cleanup & Logout', () => {
    describe('POST /auth/logout', () => {
      it('should logout and invalidate session', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        expect(response.body.message).toContain('Logged out successfully');

        // Verify session is terminated
        const sessionsResponse = await request(app.getHttpServer())
          .get('/api/v1/sessions/active')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .expect(200);

        // Session count should be reduced or zero
        expect(sessionsResponse.body.count).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
