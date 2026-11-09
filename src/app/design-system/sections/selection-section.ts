import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import {
  ButtonComponent,
  type ComboOption,
  ComboboxComponent,
  FieldComponent,
  MultiselectComponent,
  TabComponent,
  TabContentDirective,
  TabsComponent,
} from '@ui/index';

const TEAMS: ComboOption[] = [
  { value: 'ops', label: 'Operations' },
  { value: 'fin', label: 'Finance' },
  { value: 'hr', label: 'People and Culture' },
  { value: 'eng', label: 'Engineering' },
  { value: 'cs', label: 'Customer Support', disabled: true },
  { value: 'log', label: 'Logistics' },
];

const SKILLS: ComboOption[] = [
  { value: 'fork', label: 'Forklift licence' },
  { value: 'first-aid', label: 'First aid' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'rota', label: 'Rota planning' },
  { value: 'onboarding', label: 'Onboarding' },
];

@Component({
  selector: 'app-ds-selection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ComboboxComponent,
    FieldComponent,
    FormField,
    MultiselectComponent,
    TabComponent,
    TabContentDirective,
    TabsComponent,
  ],
  template: `
    <section class="space-y-10">
      <div class="space-y-3">
        <h2 class="font-title text-2xl">Combobox</h2>
        <p class="text-base text-foreground-subtle">
          Type to filter, ArrowUp and ArrowDown to move, Home and End to jump, Enter to pick, Escape
          to close. The clear button resets the value.
        </p>
        <div class="grid max-w-3xl gap-4 sm:grid-cols-2">
          <ui-field label="Team" hint="Default">
            <ui-combobox [options]="teams" placeholder="Search teams" />
          </ui-field>
          <ui-field label="Open">
            <div class="space-y-2">
              <ui-combobox #openBox [options]="teams" placeholder="Search teams" />
              <button ui-button variant="secondary" size="sm" type="button" (click)="showOpen()">
                Open the list
              </button>
            </div>
          </ui-field>
          <ui-field label="Selected">
            <ui-combobox [options]="teams" value="fin" />
          </ui-field>
          <ui-field label="Disabled">
            <ui-combobox [options]="teams" value="ops" disabled />
          </ui-field>
          <ui-field label="Read only">
            <ui-combobox [options]="teams" value="ops" readonly />
          </ui-field>
          <ui-field label="Team (form)" [error]="teamError()" required>
            <ui-combobox [formField]="f.team" [options]="teams" placeholder="Search teams" />
          </ui-field>
          <ui-field label="Empty result" hint="Nothing matches the options given">
            <ui-combobox [options]="none" emptyText="No teams yet" />
          </ui-field>
          <ui-field label="Loading" hint="Shown while options are fetched">
            <ui-combobox [options]="none" loading placeholder="Search colleagues" />
          </ui-field>
          <ui-field label="Server search" hint="Filters through the query output">
            <ui-combobox
              [options]="found()"
              externalFilter
              placeholder="Search colleagues"
              (query)="search($event)"
            />
          </ui-field>
          <ui-field label="Small">
            <ui-combobox size="sm" [options]="teams" />
          </ui-field>
          <ui-field label="Large">
            <ui-combobox size="lg" [options]="teams" />
          </ui-field>
        </div>
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Multiselect</h2>
        <p class="text-base text-foreground-subtle">
          Picked values become chips. Backspace in the empty input removes the last chip.
        </p>
        <div class="grid max-w-3xl gap-4 sm:grid-cols-2">
          <ui-field label="Skills">
            <ui-multiselect [options]="skills" placeholder="Add skills" />
          </ui-field>
          <ui-field label="Open">
            <div class="space-y-2">
              <ui-multiselect #openMulti [options]="skills" placeholder="Add skills" />
              <button ui-button variant="secondary" size="sm" type="button" (click)="showMulti()">
                Open the list
              </button>
            </div>
          </ui-field>
          <ui-field label="Selected">
            <ui-multiselect [options]="skills" [value]="['fork', 'first-aid', 'rota']" />
          </ui-field>
          <ui-field label="Disabled">
            <ui-multiselect [options]="skills" [value]="['payroll']" disabled />
          </ui-field>
          <ui-field label="Skills (form)">
            <ui-multiselect [formField]="f.skills" [options]="skills" placeholder="Add skills" />
          </ui-field>
          <ui-field label="Empty result">
            <ui-multiselect [options]="none" emptyText="No skills defined" />
          </ui-field>
          <ui-field label="Loading">
            <ui-multiselect [options]="none" loading placeholder="Add skills" />
          </ui-field>
        </div>
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Tabs</h2>
        <p class="text-base text-foreground-subtle">
          ArrowLeft and ArrowRight move and select, Home and End jump. The Documents tab builds its
          content only when it is opened.
        </p>
        <ui-tabs ariaLabel="Employee sections" class="max-w-3xl">
          <ui-tab value="overview" label="Overview">
            <p class="text-base text-foreground">
              Amira Hassan, Logistics. Joined 4 March 2024, reports to Daniel Okafor.
            </p>
          </ui-tab>
          <ui-tab value="leave" label="Leave">
            <p class="text-base text-foreground">12 days of annual leave left for 2026.</p>
          </ui-tab>
          <ui-tab value="docs" label="Documents">
            <ng-template uiTabContent>
              <p class="text-base text-foreground">Contract and right-to-work check on file.</p>
            </ng-template>
          </ui-tab>
          <ui-tab value="payroll" label="Payroll" disabled>
            <p class="text-base text-foreground">Not available.</p>
          </ui-tab>
        </ui-tabs>

        <h3 class="font-title text-lg">Vertical</h3>
        <ui-tabs
          ariaLabel="Settings sections"
          orientation="vertical"
          value="notifications"
          class="max-w-3xl"
        >
          <ui-tab value="profile" label="Profile">
            <p class="text-base text-foreground">Name, photo and contact details.</p>
          </ui-tab>
          <ui-tab value="notifications" label="Notifications">
            <p class="text-base text-foreground">Choose which approvals reach your inbox.</p>
          </ui-tab>
          <ui-tab value="security" label="Security">
            <p class="text-base text-foreground">Password and two-step sign-in.</p>
          </ui-tab>
        </ui-tabs>
      </div>
    </section>
  `,
})
export class SelectionSectionComponent {
  protected readonly teams = TEAMS;
  protected readonly skills = SKILLS;
  protected readonly none: ComboOption[] = [];

  private readonly openBox = viewChild<ComboboxComponent>('openBox');
  private readonly openMulti = viewChild<MultiselectComponent>('openMulti');

  protected readonly model = signal({ team: '', skills: [] as string[] });
  protected readonly f = form(this.model, (p) => {
    required(p.team, { message: 'Team is required' });
  });
  protected readonly teamError = computed(() => {
    const state = this.f.team();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  });

  protected readonly found = signal<ComboOption[]>([]);

  protected showOpen(): void {
    this.openBox()?.openList();
  }

  protected showMulti(): void {
    this.openMulti()?.openList();
  }

  /** Stand-in for a server search: the caller owns debouncing and loading state. */
  protected search(text: string): void {
    const colleagues: ComboOption[] = [
      { value: 'c1', label: 'Amira Hassan' },
      { value: 'c2', label: 'Daniel Okafor' },
      { value: 'c3', label: 'Priya Nair' },
    ];
    this.found.set(colleagues.filter((c) => c.label.toLowerCase().includes(text.toLowerCase())));
  }
}
