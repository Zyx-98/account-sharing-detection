import { Session } from 'src/modules/session/entities/session.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';

export enum DeviceType {
  WEB = 'web',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  TABLET = 'tablet',
}

@Entity('devices')
@Index(['userId', 'fingerprintHash'], { unique: true })
@Index(['userId', 'isTrusted'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  fingerprintHash: string;

  @Column({ nullable: true })
  deviceName: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
    default: DeviceType.WEB,
  })
  deviceType: DeviceType;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 50 })
  trustScore: number;

  @Column({ default: false })
  isTrusted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    userAgent?: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    hardwareConcurrency?: number;
    canvasHash?: string;
    webglHash?: string;
    browserFingerprint?: string;
  };

  @CreateDateColumn()
  firstSeenAt: Date;

  @Column({ nullable: true })
  lastSeenAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Session, (session) => session.device)
  sessions: Session[];
}
