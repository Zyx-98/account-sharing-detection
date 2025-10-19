import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskService } from './risk.service';
import { RiskController } from './risk.controller';
import { RiskAlert } from './entities/risk-alert.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiskAlert])],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
