import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum AlertType {
  SUSPICIOUS_DEVICE = 'suspicious_device',
  CONCURRENT_SESSIONS = 'concurrent_sessions',
  IMPOSSIBLE_TRAVEL = 'impossible_travel',
  UNUSUAL_BEHAVIOR = 'unusual_behavior',
  HIGH_RISK_SCORE = 'high_risk_score',
  MULTIPLE_LOCATIONS = 'multiple_locations',
  RAPID_DEVICE_SWITCHING = 'rapid_device_switching',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('risk_alerts')
@Index(['userId', 'isResolved'])
@Index(['alertType', 'severity'])
@Index(['createdAt'])
export class RiskAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: AlertType,
  })
  alertType: AlertType;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.riskAlerts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
