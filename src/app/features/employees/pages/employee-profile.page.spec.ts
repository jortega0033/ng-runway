import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { ToastService } from '@ui/toast/toast';
import { useMockApi } from '../../../testing/msw-test-server';
import employeesEn from '../../../../../public/i18n/employees/en.json';
import { EmployeeProfilePage } from './employee-profile.page';

@Component({ template: 'list' })
class ListStub {}

describe('EmployeeProfilePage', () => {
  const api = useMockApi();

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'employees', component: ListStub },
            { path: 'employees/:id', component: EmployeeProfilePage },
          ],
          withComponentInputBinding(),
        ),
        ...api.providers({ employees: employeesEn }),
        provideTranslocoScope('employees'),
      ],
    });
  }

  const sara = () => api.db.state.employees.find((e) => e.userRole === 'employee')!;

  async function open(id: string) {
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/employees/${id}`);
    const root = harness.routeNativeElement as HTMLElement;
    const settle = async (assertion: () => void) =>
      vi.waitFor(() => {
        harness.detectChanges();
        assertion();
      });
    return { harness, root, settle };
  }

  const tab = (root: HTMLElement, name: string) =>
    Array.from(root.querySelectorAll<HTMLElement>('[role=tab]')).find((t) =>
      t.textContent?.includes(name),
    )!;

  const button = (root: ParentNode, text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.trim().includes(text),
    );

  describe('as a manager', () => {
    beforeEach(() => api.signIn('manager'));

    it('shows the header, the role and the details tab', async () => {
      const employee = sara();
      const { root, settle } = await open(employee.id);
      await settle(() => {
        expect(root.querySelector('h1')?.textContent).toContain(
          `${employee.firstName} ${employee.lastName}`,
        );
      });
      expect(root.textContent).toContain('Employee');
      expect(root.textContent).toContain(employee.email);
      expect(root.textContent).toContain('Amsterdam Floor');
      expect(
        Array.from(root.querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim()),
      ).toEqual(['Details', 'Contract', 'Schedule', 'Absences']);
    });

    it('offers Edit but not Delete', async () => {
      const { root, settle } = await open(sara().id);
      await settle(() => expect(button(root, 'Edit')).toBeDefined());
      expect(button(root, 'Delete')).toBeUndefined();
    });

    it('opens the edit form from the Edit button', async () => {
      const employee = sara();
      const { root, settle } = await open(employee.id);
      await settle(() => expect(button(root, 'Edit')).toBeDefined());
      TestBed.inject(Router).resetConfig([
        { path: 'employees/:id/edit', component: ListStub },
        { path: 'employees/:id', component: EmployeeProfilePage },
      ]);
      button(root, 'Edit')!.click();
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/employees/${employee.id}/edit`),
      );
    });

    it('shows the contract tab', async () => {
      const employee = sara();
      const { root, settle } = await open(employee.id);
      await settle(() => expect(tab(root, 'Contract')).toBeDefined());
      tab(root, 'Contract').click();
      await settle(() => {
        expect(root.textContent).toContain('Contract type');
        expect(root.textContent).toContain(String(employee.contract.hoursPerWeek));
      });
    });

    it('loads the schedule of the current week only when the tab is opened', async () => {
      const { root, settle } = await open(sara().id);
      await settle(() => expect(tab(root, 'Schedule')).toBeDefined());
      expect(root.querySelector('app-employee-schedule')).toBeNull();
      tab(root, 'Schedule').click();
      await settle(() => {
        expect(root.querySelector('app-employee-schedule')).not.toBeNull();
        expect(root.querySelector('[role=progressbar]')).not.toBeNull();
        expect(root.textContent).toContain('planned of');
      });
    });

    it('shows absence balances and requests', async () => {
      const employee = sara();
      const { root, settle } = await open(employee.id);
      await settle(() => expect(tab(root, 'Absences')).toBeDefined());
      tab(root, 'Absences').click();
      await settle(() => {
        expect(root.textContent).toContain('Balances this year');
        expect(root.textContent).toContain('Vacation');
        expect(root.querySelector('[role=table]')).not.toBeNull();
      });
    });

    it('explains when the employee does not exist and offers a way back', async () => {
      const { root, settle } = await open('emp-nope');
      await settle(() => expect(root.querySelector('[role=alert]')).not.toBeNull());
      expect(root.textContent).toContain('Could not load this employee');
      expect(button(root, 'Try again')).toBeDefined();
      expect(button(root, 'Back to employees')).toBeDefined();
    });
  });

  describe('as an admin', () => {
    beforeEach(() => api.signIn('admin'));

    async function confirmDialog(text: string, fixture?: ComponentFixture<unknown>) {
      await vi.waitFor(() => {
        fixture?.detectChanges();
        expect(button(document.body.querySelector('.cdk-overlay-container')!, text)).toBeDefined();
      });
      return button(document.body.querySelector('.cdk-overlay-container')!, text)!;
    }

    it('deletes the employee after a confirmation', async () => {
      const employee = sara();
      const { root, settle, harness } = await open(employee.id);
      await settle(() => expect(button(root, 'Delete')).toBeDefined());

      button(root, 'Delete')!.click();
      expect(api.db.state.employees.some((e) => e.id === employee.id)).toBe(true);
      (await confirmDialog('Delete', undefined)).click();

      await vi.waitFor(() => {
        harness.detectChanges();
        expect(api.db.state.employees.some((e) => e.id === employee.id)).toBe(false);
      });
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/employees'));
      expect(TestBed.inject(ToastService).toasts()[0]?.title).toBe('Employee deleted');
    });

    it('keeps the employee when the confirmation is cancelled', async () => {
      const employee = sara();
      const { root, settle } = await open(employee.id);
      await settle(() => expect(button(root, 'Delete')).toBeDefined());

      button(root, 'Delete')!.click();
      (await confirmDialog('Cancel')).click();
      await vi.waitFor(() =>
        expect(document.body.querySelector('.cdk-overlay-container [role=dialog]')).toBeNull(),
      );
      expect(api.db.state.employees.some((e) => e.id === employee.id)).toBe(true);
      expect(TestBed.inject(Router).url).toBe(`/employees/${employee.id}`);
    });
  });
});
