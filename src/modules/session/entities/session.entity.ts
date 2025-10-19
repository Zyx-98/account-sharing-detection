import { ActivityLog } from 'src/modules/activity/entities/activity-log.entity';
import { Device } from 'src/modules/device/entities/device.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';

@Entity('sessions')
@Index(['userId', 'isActive'])
@Index(['deviceId', 'isActive'])
@Index(['startedAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  deviceId: string;

  @Column()
  ipAddress: string;

  @Column({ type: 'jsonb', nullable: true })
  location: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    countryCode?: string;
    region?: string;
  };

  @Column({ nullable: true })
  userAgent: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  riskScore: number;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  endedAt: Date;

  @Column({ nullable: true })
  lastActivityAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Device, (device) => device.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @OneToMany(() => ActivityLog, (activity) => activity.session)
  activities: ActivityLog[];
}
