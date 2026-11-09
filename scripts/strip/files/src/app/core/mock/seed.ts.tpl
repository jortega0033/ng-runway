import type { Employee } from '../api/models';
import { startOfWeek } from '../domain/time';
import { DB_SCHEMA_VERSION, type Db } from './db';
import { MOCK_FEATURES } from './features';

/** The three demo logins, one per role. Sign-in picks the first person with the chosen role. */
const USERS: readonly Employee[] = [
  {
    id: 'emp-admin',
    firstName: 'Anna',
    lastName: 'de Vries',
    email: 'anna.devries@example.com',
    userRole: 'admin',
  },
  {
    id: 'emp-manager',
    firstName: 'Mark',
    lastName: 'Jansen',
    email: 'mark.jansen@example.com',
    userRole: 'manager',
  },
  {
    id: 'emp-employee',
    firstName: 'Sara',
    lastName: 'Bakker',
    email: 'sara.bakker@example.com',
    userRole: 'employee',
  },
];

/** Builds the demo data set: the three users plus the seed rows of every generated feature. */
export function createSeed(today: string): Db {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    anchorWeek: startOfWeek(today),
    employees: structuredClone([...USERS]),
    collections: Object.fromEntries(MOCK_FEATURES.map((f) => [f.collection, f.seed()])),
  };
}
