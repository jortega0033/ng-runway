import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { useMockApi } from '../../../testing/msw-test-server';
import reportsEn from '../../../../../public/i18n/reports/en.json';
import { ReportsPage } from './reports.page';

describe('ReportsPage', () => {
  const api = useMockApi();

  beforeEach(() => {
    api.signIn('manager');
    TestBed.configureTestingModule({
      providers: [...api.providers({ reports: reportsEn }), provideRouter([])],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="table"]')).not.toBeNull();
    });
    return fixture;
  }

  function tableRows(root: HTMLElement): string[][] {
    return Array.from(root.querySelectorAll('[role="row"]'))
      .map((row) =>
        Array.from(row.querySelectorAll('[role="cell"], [role="gridcell"]')).map((c) =>
          (c.textContent ?? '').trim(),
        ),
      )
      .filter((cells) => cells.length > 0);
  }

  it('shows scoped texts, a row per team with a totals row and both charts', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('h1')?.textContent).toContain('Reports');
    const rows = tableRows(root);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.at(-1)?.[0]).toBe('Total');
    expect(
      root.querySelector('svg[aria-label^="Worked and scheduled hours per team"]'),
    ).not.toBeNull();
    expect(root.querySelector('svg[aria-label^="Worked hours per day"]')).not.toBeNull();
  });

  it('exports a CSV whose numbers equal the table', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:report';
    });
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export CSV',
    );
    expect(button).toBeDefined();
    button?.click();

    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^ng-runway-report-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);

    // Blob.text() drops the BOM while decoding, so check the raw bytes for it.
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const lines = (await created[0]!.text()).trim().split('\r\n');
    expect(lines[0]).toBe('Team,Worked hours,Scheduled hours,Difference,Labor cost (EUR)');
    const table = tableRows(root);
    expect(lines).toHaveLength(table.length + 1);
    table.forEach((cells, i) => {
      const csv = lines[i + 1]!.split(',');
      expect(csv[0]).toBe(cells[0]);
      // Table: "1,234.50" and "EUR 1,234.50"; CSV: "1234.50".
      const digits = (value: string) => value.replace(/[^0-9.\-+]/g, '');
      expect(csv[1]).toBe(digits(cells[1]!));
      expect(csv[2]).toBe(digits(cells[2]!));
      expect(Number(csv[3])).toBeCloseTo(Number(digits(cells[3]!)), 2);
      expect(csv[4]).toBe(digits(cells[4]!));
    });
  });
});
