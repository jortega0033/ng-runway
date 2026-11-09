import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 24x24 stroke icons. Paths are plain geometry so the set is easy to read and extend. */
const ICONS = {
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M6 15l6-6 6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'arrow-up': ['M12 19V5', 'M6 11l6-6 6 6'],
  'arrow-down': ['M12 5v14', 'M6 13l6 6 6-6'],
  'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  clock: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v4l3 2'],
  info: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 11v5', 'M12 8h.01'],
  'alert-circle': ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v5', 'M12 16h.01'],
  'alert-triangle': ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
  'check-circle': ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M8.5 12.5l2.5 2.5 4.5-5'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  dots: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  sort: ['M8 5v14', 'M4 9l4-4 4 4', 'M16 19V5', 'M12 15l4 4 4-4'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 20c0-4 4-6 8-6s8 2 8 6'],
  users: [
    'M9 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5',
    'M16 6a3 3 0 0 1 0 6',
    'M18 14.8c2 .6 3.5 2.2 3.5 5.2',
  ],
  home: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
  bell: ['M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z', 'M10 21h4'],
  settings: ['M5 7h8', 'M17 7h2', 'M15 5v4', 'M5 17h2', 'M11 17h8', 'M9 15v4'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  trash: ['M5 7h14', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  filter: ['M4 5h16l-6 8v6l-4-2v-4z'],
  logout: ['M10 4H5v16h5', 'M15 8l4 4-4 4', 'M19 12H9'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M12 2v2',
    'M12 20v2',
    'M2 12h2',
    'M20 12h2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  globe: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    'M3 12h18',
    'M12 3c3 3 3 15 0 18',
    'M12 3c-3 3-3 15 0 18',
  ],
  copy: ['M8 8h11v12H8z', 'M5 16V4h11'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  command: ['M9 9V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z'],
  wifi: [
    'M3 9a14 14 0 0 1 18 0',
    'M6 12.5a9.5 9.5 0 0 1 12 0',
    'M9 16a5 5 0 0 1 6 0',
    'M12 19.5h.01',
  ],
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

@Component({
  selector: 'ui-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @for (d of paths(); track d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class IconComponent {
  /** Icon name from the built-in set. */
  readonly name = input.required<IconName>();
  /** Pixel size of the square icon. */
  readonly size = input<16 | 20 | 24>(20);
  /** Accessible name. Leave empty for decorative icons (they get aria-hidden). */
  readonly label = input('');

  protected readonly paths = computed<readonly string[]>(() => ICONS[this.name()]);
}
