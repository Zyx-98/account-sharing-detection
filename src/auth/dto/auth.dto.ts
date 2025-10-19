import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionTier } from 'src/modules/users/entities/user.entity';

class DeviceFingerprintDto {
  @IsString()
  userAgent: string;

  @IsOptional()
  @IsString()
  screenResolution?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsNumber()
  hardwareConcurrency?: number;

  @IsOptional()
  @IsString()
  canvas?: string;

  @IsOptional()
  @IsString()
  webgl?: string;
}

class LocationDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(SubscriptionTier)
  subscriptionTier?: SubscriptionTier;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DeviceFingerprintDto)
  deviceFingerprint: DeviceFingerprintDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
