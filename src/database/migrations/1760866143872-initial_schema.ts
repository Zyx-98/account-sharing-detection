import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760866143872 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "subscription_tier_enum" AS ENUM ('free', 'basic', 'premium', 'enterprise');
      CREATE TYPE "account_status_enum" AS ENUM ('active', 'suspended', 'locked', 'pending_verification');
      
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        "subscriptionTier" "subscription_tier_enum" NOT NULL DEFAULT 'free',
        "maxDevicesAllowed" integer NOT NULL DEFAULT 3,
        "maxConcurrentSessions" integer NOT NULL DEFAULT 2,
        "accountStatus" "account_status_enum" NOT NULL DEFAULT 'active',
        "riskScore" decimal(5,2) NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastLoginAt" TIMESTAMP
      );
      
      CREATE INDEX "IDX_users_email" ON "users" ("email");
    `);

    await queryRunner.query(`
      CREATE TYPE "device_type_enum" AS ENUM ('web', 'mobile', 'desktop', 'tablet');
      
      CREATE TABLE "devices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "fingerprintHash" varchar NOT NULL,
        "deviceName" varchar,
        "deviceType" "device_type_enum" NOT NULL DEFAULT 'web',
        "trustScore" decimal(5,2) NOT NULL DEFAULT 50,
        "isTrusted" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "firstSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSeenAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_devices_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
      
      CREATE UNIQUE INDEX "IDX_devices_user_fingerprint" ON "devices" ("userId", "fingerprintHash");
      CREATE INDEX "IDX_devices_userId_isTrusted" ON "devices" ("userId", "isTrusted");
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "deviceId" uuid NOT NULL,
        "ipAddress" varchar NOT NULL,
        "location" jsonb,
        "userAgent" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "riskScore" decimal(5,2) NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "endedAt" TIMESTAMP,
        "lastActivityAt" TIMESTAMP,
        "metadata" jsonb,
        CONSTRAINT "FK_sessions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sessions_deviceId" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE
      );
      
      CREATE INDEX "IDX_sessions_userId_isActive" ON "sessions" ("userId", "isActive");
      CREATE INDEX "IDX_sessions_deviceId_isActive" ON "sessions" ("deviceId", "isActive");
      CREATE INDEX "IDX_sessions_startedAt" ON "sessions" ("startedAt");
    `);

    await queryRunner.query(`
      CREATE TYPE "activity_type_enum" AS ENUM (
        'login', 'logout', 'course_view', 'video_watch', 
        'quiz_attempt', 'download', 'profile_update', 'settings_change'
      );
      
      CREATE TABLE "activity_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "activityType" "activity_type_enum" NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        "metadata" jsonb,
        "riskScore" decimal(5,2) NOT NULL DEFAULT 0,
        CONSTRAINT "FK_activity_logs_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_logs_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE
      );
      
      CREATE INDEX "IDX_activity_logs_userId_timestamp" ON "activity_logs" ("userId", "timestamp");
      CREATE INDEX "IDX_activity_logs_sessionId_timestamp" ON "activity_logs" ("sessionId", "timestamp");
      CREATE INDEX "IDX_activity_logs_activityType" ON "activity_logs" ("activityType");
    `);

    await queryRunner.query(`
      CREATE TYPE "alert_type_enum" AS ENUM (
        'suspicious_device', 'concurrent_sessions', 'impossible_travel',
        'unusual_behavior', 'high_risk_score', 'multiple_locations', 'rapid_device_switching'
      );
      
      CREATE TYPE "alert_severity_enum" AS ENUM ('low', 'medium', 'high', 'critical');
      
      CREATE TABLE "risk_alerts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "alertType" "alert_type_enum" NOT NULL,
        "severity" "alert_severity_enum" NOT NULL,
        "description" text NOT NULL,
        "isResolved" boolean NOT NULL DEFAULT false,
        "resolvedAt" TIMESTAMP,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_risk_alerts_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
      
      CREATE INDEX "IDX_risk_alerts_userId_isResolved" ON "risk_alerts" ("userId", "isResolved");
      CREATE INDEX "IDX_risk_alerts_alertType_severity" ON "risk_alerts" ("alertType", "severity");
      CREATE INDEX "IDX_risk_alerts_createdAt" ON "risk_alerts" ("createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "risk_alerts"`);
    await queryRunner.query(`DROP TYPE "alert_severity_enum"`);
    await queryRunner.query(`DROP TYPE "alert_type_enum"`);

    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(`DROP TYPE "activity_type_enum"`);

    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TYPE "device_type_enum"`);

    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "account_status_enum"`);
    await queryRunner.query(`DROP TYPE "subscription_tier_enum"`);
  }
}
