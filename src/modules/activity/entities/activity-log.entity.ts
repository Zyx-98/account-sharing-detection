import { Session } from 'src/modules/session/entities/session.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  COURSE_VIEW = 'course_view',
  VIDEO_WATCH = 'video_watch',
  QUIZ_ATTEMPT = 'quiz_attempt',
  DOWNLOAD = 'download',
  PROFILE_UPDATE = 'profile_update',
  SETTINGS_CHANGE = 'settings_change',
}

@Entity('activity_logs')
@Index(['userId', 'timestamp'])
@Index(['sessionId', 'timestamp'])
@Index(['activityType'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  riskScore: number;

  // Relations
  @ManyToOne(() => User, (user) => user.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Session, (session) => session.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session;
}
