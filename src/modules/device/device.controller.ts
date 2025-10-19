import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DeviceService } from './device.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  async getUserDevices(@Request() req) {
    const devices = await this.deviceService.getUserDevices(req.user.userId);
    return { count: devices.length, devices };
  }

  @Post(':id/trust')
  async trustDevice(@Param('id') deviceId: string, @Request() req) {
    const device = await this.deviceService.trustDevice(
      deviceId,
      req.user.userId,
    );
    return {
      message: 'Device marked as trusted',
      device,
    };
  }

  @Delete(':id')
  async removeDevice(@Param('id') deviceId: string, @Request() req) {
    await this.deviceService.removeDevice(deviceId, req.user.userId);
    return { message: 'Device removed successfully' };
  }
}
