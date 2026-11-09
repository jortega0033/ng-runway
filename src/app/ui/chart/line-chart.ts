import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  signal,
} from '@angular/core';
import {
  CHART_MARGIN,
  CHART_WIDTH,
  DEFAULT_FORMATTER,
  SERIES_DASHES,
  hasChartData,
  injectChartColors,
  niceScale,
  seriesColor,
  type ChartSeries,
  type ChartValueFormatter,
} from './chart-core';
import {
  ChartDataTableComponent,
  ChartLegendComponent,
  ChartTooltipComponent,
} from './chart-parts';

interface Point {
  key: string;
  x: number;
  y: number;
  color: string;
  label: string;
  tooltip: string[];
}

interface Line {
  name: string;
  color: string;
  dash: string;
  path: string;
  area: string;
}

/**
 * Multi-series line chart drawn with plain svg. Each point is focusable and shows a tooltip.
 * Series differ by dash pattern as well as color. The area fill is off unless `area` is set.
 */
@Component({
  selector: 'ui-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartLegendComponent, ChartDataTableComponent, ChartTooltipComponent],
  host: { class: 'block' },
  template: `
    @if (hasData()) {
      <figure class="m-0 flex flex-col gap-3">
        <svg
          class="block h-auto w-full"
          role="img"
          [attr.viewBox]="'0 0 ' + width + ' ' + height()"
          [attr.aria-label]="ariaLabel()"
        >
          @for (tick of layout().scale.ticks; track tick) {
            <line
              [attr.x1]="margin.left"
              [attr.x2]="width - margin.right"
              [attr.y1]="layout().y(tick)"
              [attr.y2]="layout().y(tick)"
              stroke-width="1"
              [attr.stroke]="colors().gridline"
            />
            <text
              [attr.x]="margin.left - 8"
              [attr.y]="layout().y(tick) + 4"
              text-anchor="end"
              font-size="11"
              [attr.fill]="colors().support"
            >
              {{ format()(tick) }}
            </text>
          }

          @for (label of layout().categoryLabels; track label.key) {
            <text
              [attr.x]="label.x"
              [attr.y]="height() - margin.bottom + 18"
              text-anchor="middle"
              font-size="11"
              [attr.fill]="colors().support"
            >
              {{ label.text }}
            </text>
          }

          @for (line of layout().lines; track line.name) {
            @if (area()) {
              <path
                [attr.d]="line.area"
                [attr.fill]="line.color"
                fill-opacity="0.12"
                stroke="none"
              />
            }
            <path
              [attr.d]="line.path"
              fill="none"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
              [attr.stroke]="line.color"
              [attr.stroke-dasharray]="line.dash || null"
            />
          }

          @for (point of layout().points; track point.key; let i = $index) {
            <circle
              tabindex="0"
              role="graphics-symbol"
              class="outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
              r="4"
              stroke-width="2"
              [attr.cx]="point.x"
              [attr.cy]="point.y"
              [attr.fill]="colors().surface"
              [attr.stroke]="point.color"
              [attr.aria-label]="point.label"
              [attr.data-point]="i"
              (mouseenter)="active.set(i)"
              (mouseleave)="active.set(null)"
              (focus)="active.set(i)"
              (blur)="active.set(null)"
            />
          }

          @if (activePoint(); as point) {
            <g
              ui-chart-tooltip
              [x]="point.x"
              [y]="point.y"
              [lines]="point.tooltip"
              [width]="width"
              [background]="colors().tooltipBackground"
              [foreground]="colors().tooltipForeground"
            />
          }
        </svg>

        @if (showLegend()) {
          <ui-chart-legend [items]="layout().legend" kind="line" />
        }
        <ui-chart-data-table
          [caption]="label()"
          [categoryHeader]="categoryHeader()"
          [categories]="categories()"
          [series]="series()"
          [format]="format()"
        />
      </figure>
    } @else {
      <p
        class="m-0 rounded-md border border-border-subtle p-6 text-center text-base text-foreground-subtle"
      >
        {{ emptyText() }}
      </p>
    }
  `,
})
export class LineChartComponent {
  protected readonly width = CHART_WIDTH;
  protected readonly margin = CHART_MARGIN;
  protected readonly colors = injectChartColors();
  protected readonly active = signal<number | null>(null);

  /** One entry per series. Values align with `categories` by index. */
  readonly series = input.required<readonly ChartSeries[]>();
  readonly categories = input.required<readonly string[]>();
  /** Accessible name and table caption, for example "Headcount by month". */
  readonly label = input('Line chart');
  readonly format = input<ChartValueFormatter>(DEFAULT_FORMATTER);
  /** Height of the drawing in viewBox units; the svg still fills the container width. */
  readonly height = input(280);
  /** Fill the space between each line and the zero baseline. Off by default. */
  readonly area = input(false, { transform: booleanAttribute });
  readonly showLegend = input(true, { transform: booleanAttribute });
  readonly emptyText = input('No data to display');
  readonly categoryHeader = input('Category');

  protected readonly hasData = computed(() => hasChartData(this.series(), this.categories()));

  protected readonly ariaLabel = computed(
    () =>
      `${this.label()}. ${this.series().length} series, ${this.categories().length} categories. Data table follows.`,
  );

  protected readonly layout = computed(() => {
    const series = this.series();
    const categories = this.categories();
    const format = this.format();
    const palette = this.colors().series;
    const plotW = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
    const plotH = this.height() - CHART_MARGIN.top - CHART_MARGIN.bottom;

    const all = series.flatMap((s) => s.values.slice(0, categories.length));
    const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all));
    const y = (v: number) =>
      CHART_MARGIN.top + plotH * (1 - (v - scale.min) / (scale.max - scale.min));
    const band = plotW / categories.length;
    const x = (i: number) => CHART_MARGIN.left + band * (i + 0.5);
    const zero = y(0);

    const lines: Line[] = [];
    const points: Point[] = [];
    series.forEach((s, si) => {
      const color = seriesColor(s, si, palette);
      const coords: { x: number; y: number }[] = [];
      categories.forEach((category, i) => {
        const value = s.values[i];
        if (value === undefined) return;
        const point = { x: x(i), y: y(value) };
        coords.push(point);
        points.push({
          key: `${si}-${i}`,
          ...point,
          color,
          label: `${category}, ${s.name}: ${format(value)}`,
          tooltip: [category, `${s.name}: ${format(value)}`],
        });
      });
      const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
      const first = coords[0];
      const last = coords[coords.length - 1];
      lines.push({
        name: s.name,
        color,
        dash: SERIES_DASHES[si % SERIES_DASHES.length],
        path,
        area: first && last ? `${path} L${last.x} ${zero} L${first.x} ${zero} Z` : '',
      });
    });

    const every = Math.max(1, Math.ceil((categories.length * 56) / plotW));
    const categoryLabels = categories
      .map((text, i) => ({ key: `${i}`, text, x: x(i), i }))
      .filter((l) => l.i % every === 0);

    return {
      scale,
      y,
      lines,
      points,
      categoryLabels,
      legend: series.map((s, si) => ({ name: s.name, color: seriesColor(s, si, palette) })),
    };
  });

  protected readonly activePoint = computed(() => {
    const index = this.active();
    return index === null ? null : (this.layout().points[index] ?? null);
  });
}
