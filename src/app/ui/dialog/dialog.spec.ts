import { Dialog } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrawerComponent, DrawerService } from '../drawer/drawer';
import { DialogComponent } from './dialog';
import { DialogService } from './dialog-service';

@Component({
  imports: [DialogComponent],
  template: `
    <ui-dialog title="Delete shift">
      Night shift on 12 November will be removed.
      <ng-container uiDialogFooter>
        <button type="button" id="keep">Keep</button>
      </ng-container>
    </ui-dialog>
  `,
})
class ShiftDialog {}

@Component({
  imports: [DrawerComponent],
  template: `<ui-drawer title="Employee details"><input aria-label="Notes" /></ui-drawer>`,
})
class EmployeeDrawer {}

@Component({
  template: `<button type="button" id="opener" (click)="open()">Open</button>`,
})
class Host {
  private readonly dialogs = inject(DialogService);
  private readonly drawers = inject(DrawerService);
  result: boolean | null = null;
  open(): void {
    this.dialogs.open(ShiftDialog, { size: 'sm' });
  }
  openDrawer(): void {
    this.drawers.open(EmployeeDrawer, { size: 'lg' });
  }
  async ask(danger = false): Promise<void> {
    this.result = await this.dialogs.confirm({
      title: 'Delete shift?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger,
    });
  }
}

function press(key: string, target: Element = document.activeElement ?? document.body): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode: 27, bubbles: true }));
}

describe('dialog', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
    return { fixture, opener };
  }
  const dialogEl = () => document.querySelector<HTMLElement>('[role="dialog"]');

  it('opens a labelled modal and moves focus inside it', async () => {
    const { fixture, opener } = await setup();
    opener.focus();
    opener.click();
    await fixture.whenStable();

    const dialog = dialogEl()!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent).toContain('Delete shift');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('traps focus with sentinel anchors around the content', async () => {
    const { fixture, opener } = await setup();
    opener.click();
    await fixture.whenStable();
    expect(document.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(2);
  });

  it('closes on Escape and restores focus to the opener', async () => {
    const { fixture, opener } = await setup();
    opener.focus();
    opener.click();
    await fixture.whenStable();
    expect(dialogEl()).not.toBeNull();

    press('Escape');
    await fixture.whenStable();

    expect(dialogEl()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes when the backdrop is clicked', async () => {
    const { fixture, opener } = await setup();
    opener.click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await fixture.whenStable();
    expect(dialogEl()).toBeNull();
  });

  it('closes from the labelled close button', async () => {
    const { fixture, opener } = await setup();
    opener.click();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    await fixture.whenStable();
    expect(dialogEl()).toBeNull();
  });

  it('confirm resolves true on the confirm button and false on Escape', async () => {
    const { fixture } = await setup();
    const host = fixture.componentInstance;

    const yes = host.ask();
    await fixture.whenStable();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Delete']);
    buttons[1].click();
    await yes;
    expect(host.result).toBe(true);

    const no = host.ask(true);
    await fixture.whenStable();
    press('Escape');
    await no;
    expect(host.result).toBe(false);
  });

  it('opens a drawer as a right-side dialog with its own title', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.openDrawer();
    await fixture.whenStable();
    const drawer = dialogEl()!;
    expect(drawer.closest('.ui-drawer-panel')).not.toBeNull();
    expect(drawer.textContent).toContain('Employee details');
    press('Escape');
    await fixture.whenStable();
    expect(dialogEl()).toBeNull();
  });
});
