import type { NotificationKind } from '@core/api/models';
import type { IconName } from '@ui/icon/icon';

export interface NotificationKindInfo {
  icon: IconName;
  /** Page that explains the notification. `null` when there is nowhere to go. */
  link: string | null;
}

export const NOTIFICATION_KINDS: Record<NotificationKind, NotificationKindInfo> = {
  absence: { icon: 'sun', link: '/absences' },
  timesheet: { icon: 'clock', link: '/timesheets' },
  schedule: { icon: 'calendar', link: '/schedule' },
  system: { icon: 'info', link: null },
};
