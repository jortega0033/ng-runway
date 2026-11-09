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
  chartId,
  hasChartData,
  injectChartColors,
  niceScale,
  patternFor,
  seriesColor,
  type ChartSeries,
  type ChartValueFormatter,
  type SeriesPattern,
} from './chart-core';
import {
  ChartDataTableComponent,
  ChartLegendComponent,
  ChartTooltipComponent,
} from './chart-parts';

interface Bar {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  pattern: SeriesPattern;
  label: string;
  tooltip: string[];
  anchorX: number;
  anchorY: number;
}

/**
 * Vertical bar chart drawn with plain svg. One series gives single bars, several give grouped
 * bars, `stacked` stacks them (non-negative values). Every value is also available in a hidden table.
 */
@Component({
  selector: 'ui-bar-chart',
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
          <defs>
            <pattern
              [attr.id]="patternId + '-hatch'"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke-width="2.5"
                [attr.stroke]="colors().surface"
              />
            </pattern>
            <pattern
              [attr.id]="patternId + '-dots'"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="3" cy="3" r="1.4" [attr.fill]="colors().surface" />
            </pattern>
          </defs>

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

          @for (bar of layout().bars; track bar.key; let i = $index) {
            <rect
              tabindex="0"
              role="graphics-symbol"
              class="outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
              rx="2"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [attr.fill]="bar.color"
              [attr.aria-label]="bar.label"
              [attr.data-bar]="i"
              (mouseenter)="active.set(i)"
              (mouseleave)="active.set(null)"
              (focus)="active.set(i)"
              (blur)="active.set(null)"
            />
            @if (bar.pattern !== 'solid') {
              <rect
                class="pointer-events-none"
                aria-hidden="true"
                rx="2"
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                [attr.fill]="'url(#' + patternId + '-' + bar.pattern + ')'"
              />
            }
          }

          @if (activeBar(); as bar) {
            <g
              ui-chart-tooltip
              [x]="bar.anchorX"
              [y]="bar.anchorY"
              [lines]="bar.tooltip"
              [width]="width"
              [background]="colors().tooltipBackground"
              [foreground]="colors().tooltipForeground"
            />
          }
        </svg>

        @if (showLegend()) {
          <ui-chart-legend [items]="layout().legend" kind="bar" [patternPrefix]="patternId" />
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
export class BarChartComponent {
  protected readonly width = CHART_WIDTH;
  protected readonly margin = CHART_MARGIN;
  protected readonly patternId = chartId('ui-bar-chart');
  protected readonly colors = injectChartColors();
  protected readonly active = signal<number | null>(null);

  /** One entry per series. Values align with `categories` by index. */
  readonly series = input.required<readonly ChartSeries[]>();
  readonly categories = input.required<readonly string[]>();
  /** Accessible name and table caption, for example "Overtime hours per week". */
  readonly label = input('Bar chart');
  readonly format = input<ChartValueFormatter>(DEFAULT_FORMATTER);
  /** Height of the drawing in viewBox units; the svg still fills the container width. */
  readonly height = input(280);
  readonly stacked = input(false, { transform: booleanAttribute });
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
    const stacked = this.stacked();
    const format = this.format();
    const palette = this.colors().series;
    const plotW = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
    const plotH = this.height() - CHART_MARGIN.top - CHART_MARGIN.bottom;

    let low = 0;
    let high = 0;
    categories.forEach((_, i) => {
      if (stacked) {
        high = Math.max(
          high,
          series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0),
        );
      } else {
        for (const s of series) {
          const v = s.values[i] ?? 0;
          low = Math.min(low, v);
          high = Math.max(high, v);
        }
      }
    });
    const scale = niceScale(low, high);
    const y = (v: number) =>
      CHART_MARGIN.top + plotH * (1 - (v - scale.min) / (scale.max - scale.min));

    const band = plotW / categories.length;
    const inner = band * 0.7;
    const groupWidth = stacked ? inner : inner / series.length;
    const zero = y(0);
    const bars: Bar[] = [];

    categories.forEach((category, i) => {
      const bandX = CHART_MARGIN.left + i * band + (band - inner) / 2;
      let stackTop = 0;
      series.forEach((s, si) => {
        const value = s.values[i];
        if (value === undefined) return;
        const color = seriesColor(s, si, palette);
        let top: number;
        let bottom: number;
        if (stacked) {
          const from = stackTop;
          stackTop += Math.max(0, value);
          top = y(stackTop);
          bottom = y(from);
        } else {
          top = Math.min(y(value), zero);
          bottom = Math.max(y(value), zero);
        }
        const x = stacked ? bandX : bandX + si * groupWidth;
        const tooltip = [category, `${s.name}: ${format(value)}`];
        if (stacked && series.length > 1) {
          tooltip.push(`Total: ${format(series.reduce((sum, t) => sum + (t.values[i] ?? 0), 0))}`);
        }
        bars.push({
          key: `${si}-${i}`,
          x,
          y: top,
          width: Math.max(groupWidth - (stacked || series.length === 1 ? 0 : 2), 1),
          height: Math.max(bottom - top, 1),
          color,
          pattern: patternFor(si),
          label: `${category}, ${s.name}: ${format(value)}`,
          tooltip,
          anchorX: x + groupWidth / 2,
          anchorY: top,
        });
      });
    });

    const every = Math.max(1, Math.ceil((categories.length * 56) / plotW));
    const categoryLabels = categories
      .map((text, i) => ({ key: `${i}`, text, x: CHART_MARGIN.left + band * (i + 0.5), i }))
      .filter((l) => l.i % every === 0);

    return {
      scale,
      y,
      bars,
      categoryLabels,
      legend: series.map((s, si) => ({ name: s.name, color: seriesColor(s, si, palette) })),
    };
  });

  protected readonly activeBar = computed(() => {
    const index = this.active();
    return index === null ? null : (this.layout().bars[index] ?? null);
  });
}
