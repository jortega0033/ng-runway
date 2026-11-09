import { DeferBlockState } from '@angular/core/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import type { Employee } from '@core/api/models';
import { formatDuration, weeklyScheduledMinutes } from '@core/domain/hours';
import { addDays, startOfWeek, todayIso } from '@core/domain/time';
import { useMockApi } from '../../../testing/msw-test-server';
import dashboardEn from '../../../../../public/i18n/dashboard/en.json';
import { teamOnShift, upcomingShifts, weekProgress } from '../dashboard.logic';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  const api = useMockApi();

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...api.providers({ dashboard: dashboardEn }),
        provideTranslocoScope('dashboard'),
      ],
    });
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  /** Re-renders until the assertion holds: the cards load through real (mocked) HTTP. */
  async function eventually(fixture: ComponentFixture<unknown>, assertion: () => void) {
    await vi.waitFor(() => {
      fixture.detectChanges();
      assertion();
    });
  }

  /** The viewport trigger needs a scroll position, so the lower cards are rendered by hand. */
  async function renderDeferred(fixture: ComponentFixture<unknown>) {
    const blocks = await fixture.getDeferBlocks();
    for (const block of blocks) await block.render(DeferBlockState.Complete);
    fixture.detectChanges();
    return blocks.length;
  }

  const section = (root: HTMLElement, heading: string): HTMLElement => {
    const h2 = Array.from(root.querySelectorAll('h2')).find((h) =>
      h.textContent?.includes(heading),
    );
    if (!h2) throw new Error(`No card titled "${heading}"`);
    return h2.closest('ui-card') as HTMLElement;
  };

  const userOf = (role: 'employee' | 'manager' | 'admin'): Employee => {
    const user = api.db.state.employees.find((e) => e.userRole === role);
    if (!user) throw new Error(`No ${role}`);
    return user;
  };

  describe('as an employee', () => {
    beforeEach(() => api.signIn('employee'));

    it('shows the scoped texts and the personal cards', async () => {
      const { fixture, root } = setup();
      await eventually(fixture, () => {
        expect(root.querySelector('h1')?.textContent).toContain('My overview');
        expect(root.textContent).toContain('Welcome back, Sara');
      });
      for (const title of ['Next shifts', 'Hours this week', 'Pending requests']) {
        expect(section(root, title)).toBeTruthy();
      }
    });

    it('lists the next shifts of the signed-in user', async () => {
      const user = userOf('employee');
      const expected = upcomingShifts(api.db.state.shifts, user.id, new Date());
      expect(expected.length).toBeGreaterThan(0);
      const { fixture, root } = setup();
      await eventually(fixture, () => {
        const items = section(root, 'Next shifts').querySelectorAll('li');
        expect(items).toHaveLength(Math.min(5, expected.length));
        expect(items[0]?.textContent).toContain(`${expected[0]?.start} - ${expected[0]?.end}`);
      });
    });

    it('compares planned hours with the contract hours', async () => {
      const user = userOf('employee');
      const weekStart = startOfWeek(todayIso());
      const planned = weeklyScheduledMinutes(
        api.db.state.shifts.filter((s) => s.status === 'published'),
        user.id,
        weekStart,
      );
      const expected = weekProgress(planned, user.contract.hoursPerWeek);
      const { fixture, root } = setup();
      await eventually(fixture, () => {
        const card = section(root, 'Hours this week');
        const bar = card.querySelector('[role=progressbar]');
        expect(bar?.getAttribute('aria-valuenow')).toBe(String(expected.percent));
        expect(card.textContent).toContain(formatDuration(planned));
        expect(card.textContent).toContain(`${user.contract.hoursPerWeek} h contract`);
      });
    });

    it('shows only the own pending absence requests', async () => {
      const user = userOf('employee');
      api.db.state.absences.push(
        {
          id: 'abs-mine',
          employeeId: user.id,
          type: 'vacation',
          startDate: addDays(todayIso(), 14),
          endDate: addDays(todayIso(), 18),
          status: 'pending',
          reason: 'Family visit',
          comment: '',
        },
        {
          id: 'abs-other',
          employeeId: userOf('manager').id,
          type: 'sick',
          startDate: addDays(todayIso(), 3),
          endDate: addDays(todayIso(), 3),
          status: 'pending',
          reason: '',
          comment: '',
        },
      );
      const own = api.db.state.absences.filter(
        (a) => a.employeeId === user.id && a.status === 'pending',
      );
      const { fixture, root } = setup();
      await eventually(fixture, () => {
        const items = section(root, 'Pending requests').querySelectorAll('li');
        expect(items).toHaveLength(own.length);
        expect(section(root, 'Pending requests').textContent).toContain('Vacation');
      });
    });

    it('defers the team card and fills it with colleagues on shift today', async () => {
      const user = userOf('employee');
      const today = todayIso();
      // Make sure at least the user works today, so the card has something to show.
      api.db.state.shifts.push({
        id: 'shift-today',
        employeeId: user.id,
        teamId: user.teamId,
        locationId: user.locationId,
        date: today,
        start: '09:00',
        end: '17:00',
        breakMinutes: 30,
        status: 'published',
        note: '',
      });
      const team = api.db.state.employees.filter((e) => e.teamId === user.teamId && e.active);
      const expected = teamOnShift(
        team,
        api.db.state.shifts.filter((s) => s.teamId === user.teamId && s.date === today),
      );

      const { fixture, root } = setup();
      expect(root.textContent).not.toContain('Team on shift today');
      expect(await renderDeferred(fixture)).toBe(1);
      await eventually(fixture, () => {
        const card = section(root, 'Team on shift today');
        expect(card.querySelectorAll('li')).toHaveLength(expected.length);
        expect(card.textContent).toContain(`${user.firstName} ${user.lastName}`);
        expect(card.textContent).toContain('09:00 - 17:00');
      });
    });

    it('does not show approvals', async () => {
      const { fixture, root } = setup();
      await renderDeferred(fixture);
      await eventually(fixture, () => {
        expect(root.textContent).toContain('Team on shift today');
      });
      expect(root.textContent).not.toContain('Approvals waiting');
    });
  });

  describe('as a manager', () => {
    beforeEach(() => api.signIn('manager'));

    it('adds the approvals card, counted for the own team', async () => {
      const manager = userOf('manager');
      const teammate = api.db.state.employees.find(
        (e) => e.teamId === manager.teamId && e.userRole === 'employee',
      )!;
      api.db.state.absences.push({
        id: 'abs-wait',
        employeeId: teammate.id,
        type: 'vacation',
        startDate: addDays(todayIso(), 21),
        endDate: addDays(todayIso(), 25),
        status: 'pending',
        reason: '',
        comment: '',
      });
      const inTeam = (employeeId: string) =>
        api.db.state.employees.find((e) => e.id === employeeId)?.teamId === manager.teamId;
      const absences = api.db.state.absences.filter(
        (a) => a.status === 'pending' && inTeam(a.employeeId),
      ).length;
      const entries = api.db.state.clockEntries.filter(
        (c) => c.status === 'submitted' && inTeam(c.employeeId),
      ).length;
      expect(absences).toBeGreaterThan(0);
      expect(entries).toBeGreaterThan(0);

      const { fixture, root } = setup();
      expect(root.textContent).not.toContain('Approvals waiting');
      expect(await renderDeferred(fixture)).toBe(2);
      await eventually(fixture, () => {
        const card = section(root, 'Approvals waiting');
        expect(card.textContent).toContain(`Absence requests (${absences})`);
        expect(card.textContent).toContain(`Submitted hours (${entries})`);
        expect(card.querySelector('p span')?.textContent?.trim()).toBe(String(absences + entries));
      });
      const card = section(root, 'Approvals waiting');
      const links = Array.from(card.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(links).toContain('/absences');
      expect(links).toContain('/timesheets');
    });

    it('still shows the personal cards', async () => {
      const { fixture, root } = setup();
      await eventually(fixture, () => {
        expect(section(root, 'Next shifts')).toBeTruthy();
        expect(section(root, 'Hours this week')).toBeTruthy();
      });
    });
  });

  describe('as an admin', () => {
    beforeEach(() => api.signIn('admin'));

    it('counts approvals across all teams', async () => {
      const absences = api.db.state.absences.filter((a) => a.status === 'pending').length;
      const entries = api.db.state.clockEntries.filter((c) => c.status === 'submitted').length;
      const { fixture, root } = setup();
      await renderDeferred(fixture);
      await eventually(fixture, () => {
        const card = section(root, 'Approvals waiting');
        expect(card.textContent).toContain(`Absence requests (${absences})`);
        expect(card.textContent).toContain(`Submitted hours (${entries})`);
      });
    });
  });
});
