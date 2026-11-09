import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  SERIES_DASHES,
  patternFor,
  type ChartSeries,
  type ChartValueFormatter,
} from './chart-core';

export interface LegendItem {
  name: string;
  color: string;
}

/** Legend with a swatch per series. Swatches repeat the pattern or dash used in the plot. */
@Component({
  selector: 'ui-chart-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-subtle">
      @for (item of items(); track item.name; let i = $index) {
        <li class="inline-flex items-center gap-1.5">
          <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" focusable="false">
            @if (kind() === 'bar') {
              <rect width="18" height="12" rx="2" [attr.fill]="item.color" />
              @if (pattern(i) !== 'solid') {
                <rect
                  width="18"
                  height="12"
                  rx="2"
                  [attr.fill]="'url(#' + patternPrefix() + '-' + pattern(i) + ')'"
                />
              }
            } @else {
              <line
                x1="0"
                y1="6"
                x2="18"
                y2="6"
                stroke-width="2.5"
                [attr.stroke]="item.color"
                [attr.stroke-dasharray]="dash(i) || null"
              />
            }
          </svg>
          {{ item.name }}
        </li>
      }
    </ul>
  `,
})
export class ChartLegendComponent {
  readonly items = input.required<readonly LegendItem[]>();
  readonly kind = input<'bar' | 'line'>('bar');
  /** Id prefix of the pattern defs in the sibling plot svg. */
  readonly patternPrefix = input('');

  protected pattern(index: number) {
    return patternFor(index);
  }

  protected dash(index: number): string {
    return SERIES_DASHES[index % SERIES_DASHES.length];
  }
}

/** Screen reader fallback: every value in a table, so nothing depends on color or hover. */
@Component({
  selector: 'ui-chart-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sr-only' },
  template: `
    <table>
      <caption>
        {{
          caption()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ categoryHeader() }}</th>
          @for (s of series(); track s.name) {
            <th scope="col">{{ s.name }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (category of categories(); track $index; let row = $index) {
          <tr>
            <th scope="row">{{ category }}</th>
            @for (s of series(); track s.name) {
              <td>{{ cell(s, row) }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class ChartDataTableComponent {
  readonly caption = input.required<string>();
  readonly categoryHeader = input('Category');
  readonly categories = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly format = input.required<ChartValueFormatter>();

  protected cell(series: ChartSeries, row: number): string {
    const value = series.values[row];
    return value === undefined ? '' : this.format()(value);
  }
}

/** Tooltip drawn in svg space so it needs no overlay positioning. Sits above the anchor, flips below at the top edge. */
@Component({
  selector: 'g[ui-chart-tooltip]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'pointer-events-none', 'data-chart-tooltip': '' },
  template: `
    <svg:rect
      [attr.x]="box().x"
      [attr.y]="box().y"
      [attr.width]="box().width"
      [attr.height]="box().height"
      rx="4"
      [attr.fill]="background()"
    />
    @for (line of lines(); track $index; let i = $index) {
      <svg:text
        [attr.x]="box().x + 8"
        [attr.y]="box().y + 16 + i * LINE_HEIGHT"
        font-size="11"
        [attr.font-weight]="i === 0 ? 600 : 400"
        [attr.fill]="foreground()"
      >
        {{ line }}
      </svg:text>
    }
  `,
})
export class ChartTooltipComponent {
  protected readonly LINE_HEIGHT = 15;

  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly lines = input.required<readonly string[]>();
  readonly width = input.required<number>();
  readonly background = input.required<string>();
  readonly foreground = input.required<string>();

  protected readonly box = computed(() => {
    const lines = this.lines();
    const chars = Math.max(...lines.map((line) => line.length), 1);
    const w = Math.ceil(chars * 6.1) + 16;
    const h = lines.length * this.LINE_HEIGHT + 8;
    const x = Math.min(Math.max(this.x() - w / 2, 0), this.width() - w);
    const above = this.y() - h - 8;
    return { x, y: above < 0 ? this.y() + 12 : above, width: w, height: h };
  });
}
