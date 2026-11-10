import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { dataTokens } from '@tokens';
import { ThemeService } from '@core/theme/theme.service';
import { BarChartComponent } from './bar-chart';
import { niceScale, readChartColors, type ChartSeries } from './chart-core';
import { LineChartComponent } from './line-chart';

const CATEGORIES = ['Mon', 'Tue', 'Wed'];
const SERIES: ChartSeries[] = [
  { name: 'Planned', values: [8, 6, 7] },
  { name: 'Worked', values: [9, 5, 7.5] },
];

@Component({
  imports: [BarChartComponent, LineChartComponent],
  template: `
    <ui-bar-chart
      id="bar"
      label="Hours per day"
      [series]="series()"
      [categories]="categories()"
      [stacked]="stacked()"
      [format]="fmt"
    />
    <ui-line-chart
      id="line"
      label="Hours trend"
      [series]="series()"
      [categories]="categories()"
      [area]="area()"
      [format]="fmt"
    />
  `,
})
class Host {
  readonly series = signal<ChartSeries[]>(SERIES);
  readonly categories = signal<string[]>(CATEGORIES);
  readonly stacked = signal(false);
  readonly area = signal(false);
  readonly fmt = (v: number) => `${v} h`;
}

describe('charts', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(dataTokens.chart.brand.cssVar);
    document.documentElement.style.removeProperty(dataTokens.chart.gridline.cssVar);
  });

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, root };
  }

  it('renders one bar per series and category', async () => {
    const { root } = await setup();
    expect(root.querySelectorAll('#bar [data-bar]')).toHaveLength(6);
  });

  it('renders one focusable point per value and one path per series', async () => {
    const { root } = await setup();
    expect(root.querySelectorAll('#line [data-point]')).toHaveLength(6);
    expect(root.querySelectorAll('#line path')).toHaveLength(2);
    expect(root.querySelector('#line [data-point]')?.getAttribute('tabindex')).toBe('0');
  });

  it('keeps the area fill off by default and adds it on request', async () => {
    const { fixture, host, root } = await setup();
    expect(root.querySelectorAll('#line path[fill-opacity]')).toHaveLength(0);
    host.area.set(true);
    await fixture.whenStable();
    expect(root.querySelectorAll('#line path[fill-opacity]')).toHaveLength(2);
  });

  it('stacks series into one column per category', async () => {
    const { fixture, host, root } = await setup();
    const grouped = root.querySelectorAll('#bar [data-bar]');
    expect(grouped[0].getAttribute('x')).not.toBe(grouped[1].getAttribute('x'));
    host.stacked.set(true);
    await fixture.whenStable();
    const stacked = root.querySelectorAll('#bar [data-bar]');
    expect(stacked).toHaveLength(6);
    expect(stacked[0].getAttribute('x')).toBe(stacked[1].getAttribute('x'));
  });

  it('exposes role=group with a label and a hidden table with every formatted value', async () => {
    const { root } = await setup();
    const svg = root.querySelector('#bar svg');
    expect(svg?.getAttribute('role')).toBe('group');
    expect(svg?.getAttribute('aria-label')).toContain('Hours per day');

    const table = root.querySelector('#bar ui-chart-data-table')!;
    expect(table.classList.contains('sr-only')).toBe(true);
    expect(table.querySelector('caption')?.textContent?.trim()).toBe('Hours per day');
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Category', 'Planned', 'Worked']);
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.children].map((c) => c.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['Mon', '8 h', '9 h'],
      ['Tue', '6 h', '5 h'],
      ['Wed', '7 h', '7.5 h'],
    ]);
  });

  it('shows a legend entry per series', async () => {
    const { root } = await setup();
    const items = [...root.querySelectorAll('#line ui-chart-legend li')].map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual(['Planned', 'Worked']);
  });

  it('shows a tooltip when a bar gets keyboard focus and hides it on blur', async () => {
    const { fixture, root } = await setup();
    const bar = root.querySelector<SVGElement>('#bar [data-bar="1"]')!;
    expect(root.querySelector('#bar [data-chart-tooltip]')).toBeNull();
    bar.dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    const tooltip = root.querySelector('#bar [data-chart-tooltip]');
    expect(tooltip?.textContent).toContain('Mon');
    expect(tooltip?.textContent).toContain('Worked: 9 h');
    bar.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(root.querySelector('#bar [data-chart-tooltip]')).toBeNull();
  });

  it('shows a tooltip when a line point is hovered', async () => {
    const { fixture, root } = await setup();
    root.querySelector('#line [data-point="1"]')!.dispatchEvent(new Event('mouseenter'));
    await fixture.whenStable();
    expect(root.querySelector('#line [data-chart-tooltip]')?.textContent).toContain('Tue');
  });

  it('renders the empty text instead of an svg when there is no data', async () => {
    const { fixture, host, root } = await setup();
    host.series.set([]);
    await fixture.whenStable();
    expect(root.querySelector('#bar svg')).toBeNull();
    expect(root.querySelector('#line svg')).toBeNull();
    expect(root.textContent).toContain('No data to display');
  });

  describe('colors', () => {
    it('falls back to the JSON tokens when the CSS variable is missing', () => {
      const colors = readChartColors(document.documentElement);
      expect(colors.gridline).toBe(dataTokens.chart.gridline.fallback);
      expect(colors.tooltipBackground).toBe(dataTokens.chart['tooltip-background'].fallback);
      expect(colors.series[0]).toBe(dataTokens.chart.brand.fallback);
    });

    it('prefers the CSS custom property when it is set', () => {
      document.documentElement.style.setProperty(dataTokens.chart.gridline.cssVar, '#123456');
      expect(readChartColors(document.documentElement).gridline).toBe('#123456');
    });

    it('re-reads the colors when the theme changes', async () => {
      const { fixture, root } = await setup();
      const stroke = () => root.querySelector('#bar svg > line')?.getAttribute('stroke');
      expect(stroke()).toBe(dataTokens.chart.gridline.fallback);

      document.documentElement.style.setProperty(dataTokens.chart.gridline.cssVar, '#abcdef');
      TestBed.inject(ThemeService).set('dark');
      await fixture.whenStable();
      expect(stroke()).toBe('#abcdef');
      TestBed.inject(ThemeService).set('light');
    });

    it('uses an explicit series color over the palette', async () => {
      const { fixture, host, root } = await setup();
      host.series.set([{ name: 'Overtime', color: '#ff00ff', values: [1, 2, 3] }]);
      await fixture.whenStable();
      expect(root.querySelector('#bar [data-bar]')?.getAttribute('fill')).toBe('#ff00ff');
    });
  });

  it('niceScale rounds bounds to 1/2/5 steps and always includes zero', () => {
    expect(niceScale(0, 9)).toEqual({ min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10] });
    expect(niceScale(-3, 7).min).toBeLessThanOrEqual(-3);
  });
});
