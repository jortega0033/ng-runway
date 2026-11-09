import type {
  AbsenceRequest,
  AbsenceType,
  AppNotification,
  ClockEntry,
  Employee,
  Location,
  Shift,
  ShiftTemplate,
  Team,
} from '../api/models';

/** Everything the mock API knows. One plain object so it can be saved as JSON. */
export interface Db {
  /** Bump when the shape changes; older saved data is then discarded. */
  schemaVersion: number;
  /** Monday of the week the data was seeded for. Seed data is relative to it. */
  anchorWeek: string;
  locations: Location[];
  teams: Team[];
  employees: Employee[];
  shifts: Shift[];
  shiftTemplates: ShiftTemplate[];
  clockEntries: ClockEntry[];
  absenceTypes: AbsenceType[];
  absences: AbsenceRequest[];
  notifications: AppNotification[];
}

export const DB_SCHEMA_VERSION = 1;
export const DB_STORAGE_KEY = 'ng-runway.db';

/** Minimal storage surface, so tests can pass a fake instead of `localStorage`. */
export interface DbStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MockDb {
  private data: Db;

  constructor(
    private readonly seed: () => Db,
    private readonly storage: DbStorage | null = null,
    private readonly currentWeek: () => string,
  ) {
    this.data = this.load() ?? this.seed();
  }

  get state(): Db {
    return this.data;
  }

  /** Call after every write so a page reload keeps the change. */
  save(): void {
    try {
      this.storage?.setItem(DB_STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: the in-memory copy still works for this session.
    }
  }

  reset(): void {
    this.storage?.removeItem(DB_STORAGE_KEY);
    this.data = this.seed();
    this.save();
  }

  private load(): Db | null {
    try {
      const raw = this.storage?.getItem(DB_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Db;
      // Old shape, or data seeded in an earlier week: start fresh so the demo is never empty.
      if (parsed.schemaVersion !== DB_SCHEMA_VERSION || parsed.anchorWeek !== this.currentWeek()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
