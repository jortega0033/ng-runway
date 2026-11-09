import type { UserRole } from '../api/models';
import type { NavItem } from '@ui/nav/sidebar-nav';

interface RoleNavItem extends NavItem {
  /** Translation key for the label. */
  key: string;
  roles: readonly UserRole[];
}

const ALL: readonly UserRole[] = ['admin', 'manager', 'employee'];

/** Every screen and who may open it. Add a row here when you add a feature. */
export const NAV: readonly RoleNavItem[] = [
  { key: 'nav.home', label: '', icon: 'home', link: '/dashboard', roles: ALL },
  { key: 'nav.settings', label: '', icon: 'settings', link: '/settings', roles: ALL },
  // gen:feature:nav
  { key: 'nav.designSystem', label: '', icon: 'grid', link: '/design-system', roles: ALL },
];

export function navFor(role: UserRole | null, translate: (key: string) => string): NavItem[] {
  if (!role) return [];
  return NAV.filter((item) => item.roles.includes(role)).map(({ key, roles, ...item }) => ({
    ...item,
    roles,
    label: translate(key),
  }));
}
