import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Device, DeviceType } from './entities/device.entity';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async registerDevice(userId: string, fingerprint: any): Promise<Device> {
    const fingerprintHash = this.generateFingerprintHash(fingerprint);

    // Check if device already exists
    let device = await this.deviceRepository.findOne({
      where: {
        userId,
        fingerprintHash,
      },
    });

    if (device) {
      // Update last seen
      device.lastSeenAt = new Date();
      device.metadata = { ...device.metadata, ...fingerprint };

      // Increase trust score for returning device
      const currentScore = parseFloat(device.trustScore.toString());
      device.trustScore = Math.min(currentScore + 5, 100) as any;

      return this.deviceRepository.save(device);
    }

    // Create new device
    const deviceType = this.detectDeviceType(fingerprint.userAgent);

    device = this.deviceRepository.create({
      userId,
      fingerprintHash,
      deviceType,
      deviceName: this.generateDeviceName(fingerprint),
      metadata: fingerprint,
      trustScore: 50, // Initial trust score
      isTrusted: false,
      lastSeenAt: new Date(),
    });

    return this.deviceRepository.save(device);
  }

  private generateFingerprintHash(fingerprint: any): string {
    const components = [
      fingerprint.userAgent || '',
      fingerprint.screenResolution || '',
      fingerprint.timezone || '',
      fingerprint.language || '',
      fingerprint.platform || '',
      fingerprint.hardwareConcurrency || '',
      fingerprint.canvas || '',
      fingerprint.webgl || '',
    ];

    const fingerprintString = components.join('|');
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  private detectDeviceType(userAgent: string): DeviceType {
    if (!userAgent) return DeviceType.WEB;

    const ua = userAgent.toLowerCase();

    if (
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone')
    ) {
      return DeviceType.MOBILE;
    }

    if (ua.includes('tablet') || ua.includes('ipad')) {
      return DeviceType.TABLET;
    }

    if (ua.includes('electron')) {
      return DeviceType.DESKTOP;
    }

    return DeviceType.WEB;
  }

  private generateDeviceName(fingerprint: any): string {
    const platform = fingerprint.platform || 'Unknown';
    const type = this.detectDeviceType(fingerprint.userAgent);

    return `${platform} ${type}`;
  }

  async getUserDevices(userId: string): Promise<Device[]> {
    return this.deviceRepository.find({
      where: { userId },
      order: { lastSeenAt: 'DESC' },
    });
  }

  async trustDevice(deviceId: string, userId: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    device.isTrusted = true;
    device.trustScore = 90 as any;

    return this.deviceRepository.save(device);
  }

  async removeDevice(deviceId: string, userId: string): Promise<void> {
    const result = await this.deviceRepository.delete({
      id: deviceId,
      userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Device not found');
    }
  }

  async getDeviceById(deviceId: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }
}
