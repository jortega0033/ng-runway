import { DOCUMENT } from '@angular/common';
import { computed, inject, type Signal } from '@angular/core';
import { dataTokens } from '@tokens';
import { ThemeService } from '@core/theme/theme.service';

export interface ChartSeries {
  name: string;
  /** Any CSS color. Defaults to the chart palette (theme aware). */
  color?: string;
  values: readonly number[];
}

export type ChartValueFormatter = (value: number) => string;

/** Formats numbers for a locale ('en', 'nl', ...). Used when a chart gets no `format` input. */
export function numberFormatter(locale: string): ChartValueFormatter {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return (value) => formatter.format(value);
}

export const DEFAULT_FORMATTER: ChartValueFormatter = numberFormatter('en');

/** What the chart sentence is built from. Callers pass a translated function. */
export interface ChartSummaryInfo {
  readonly label: string;
  readonly series: number;
  readonly categories: number;
}
export type ChartSummaryFn = (info: ChartSummaryInfo) => string;

export const DEFAULT_SUMMARY: ChartSummaryFn = ({ label, series, categories }) =>
  `${label}. ${series} series, ${categories} categories. Data table follows.`;

/** Fixed drawing space. The svg scales to its container width through the viewBox. */
export const CHART_WIDTH = 640;
export const CHART_MARGIN = { top: 16, right: 16, bottom: 32, left: 52 } as const;

export interface ChartColors {
  gridline: string;
  support: string;
  surface: string;
  tooltipBackground: string;
  tooltipForeground: string;
  /** Default series colors, in order. */
  series: readonly string[];
}

interface ChartToken {
  readonly fallback: string;
  readonly cssVar: string;
}

/** Reads a chart token from the document's computed style, falling back to the JSON value. */
export function readChartToken(token: ChartToken, root: HTMLElement | null): string {
  if (!root) return token.fallback;
  const view = root.ownerDocument.defaultView;
  const value = view?.getComputedStyle(root).getPropertyValue(token.cssVar).trim();
  return value || token.fallback;
}

/** Series colors: brand, warning, then picks from the entity palette that stay apart from them. */
const SERIES_ENTITY_INDEXES = [1, 5, 3, 8, 2] as const;

export function readChartColors(root: HTMLElement | null): ChartColors {
  const chart = dataTokens.chart;
  const entity = dataTokens.entityPalette;
  return {
    gridline: readChartToken(chart.gridline, root),
    support: readChartToken(chart.support, root),
    surface: readChartToken(chart.surface, root),
    tooltipBackground: readChartToken(chart['tooltip-background'], root),
    tooltipForeground: readChartToken(chart['tooltip-foreground'], root),
    series: [
      readChartToken(chart.brand, root),
      readChartToken(chart.warning, root),
      ...SERIES_ENTITY_INDEXES.map((i) => entity[i]),
    ],
  };
}

/** Chart colors that are re-read whenever the resolved theme changes. Call in an injection context. */
export function injectChartColors(): Signal<ChartColors> {
  const root = inject(DOCUMENT).documentElement;
  const theme = inject(ThemeService);
  return computed(() => {
    theme.resolved();
    return readChartColors(root);
  });
}

export function seriesColor(
  series: ChartSeries,
  index: number,
  palette: readonly string[],
): string {
  return series.color ?? palette[index % palette.length];
}

export interface ChartScale {
  min: number;
  max: number;
  ticks: number[];
}

/** Round axis bounds (1, 2, 5 steps) that always include zero. */
export function niceScale(low: number, high: number, targetTicks = 5): ChartScale {
  const lo = Math.min(0, low);
  const hi = Math.max(0, high);
  if (hi === lo) return { min: 0, max: 1, ticks: [0, 1] };
  const rough = (hi - lo) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return { min, max, ticks };
}

export function hasChartData(
  series: readonly ChartSeries[],
  categories: readonly string[],
): boolean {
  return categories.length > 0 && series.some((s) => s.values.length > 0);
}

let nextChartId = 0;
export function chartId(prefix: string): string {
  return `${prefix}-${nextChartId++}`;
}

/** Non-color cue per series index: bars get a pattern, lines get a dash. */
export const SERIES_PATTERNS = ['solid', 'hatch', 'dots'] as const;
export type SeriesPattern = (typeof SERIES_PATTERNS)[number];
export const SERIES_DASHES = ['', '7 4', '2 3'] as const;

export function patternFor(index: number): SeriesPattern {
  return SERIES_PATTERNS[index % SERIES_PATTERNS.length];
}
