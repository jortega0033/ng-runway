import { relativeTime } from './relative-time';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe('relativeTime', () => {
  it('says "now" for the last few seconds', () => {
    expect(relativeTime(ago(10), NOW, 'en')).toBe('now');
  });

  it('uses minutes, hours, days, weeks and months', () => {
    expect(relativeTime(ago(5 * 60), NOW, 'en')).toBe('5 minutes ago');
    expect(relativeTime(ago(60), NOW, 'en')).toBe('1 minute ago');
    expect(relativeTime(ago(3 * 3600), NOW, 'en')).toBe('3 hours ago');
    expect(relativeTime(ago(86_400), NOW, 'en')).toBe('yesterday');
    expect(relativeTime(ago(3 * 86_400), NOW, 'en')).toBe('3 days ago');
    expect(relativeTime(ago(14 * 86_400), NOW, 'en')).toBe('2 weeks ago');
    expect(relativeTime(ago(90 * 86_400), NOW, 'en')).toBe('3 months ago');
    expect(relativeTime(ago(400 * 86_400), NOW, 'en')).toBe('last year');
  });

  it('handles a time in the future', () => {
    expect(relativeTime(ago(-2 * 3600), NOW, 'en')).toBe('in 2 hours');
  });

  it('follows the language', () => {
    expect(relativeTime(ago(5 * 60), NOW, 'nl')).toBe('5 minuten geleden');
    expect(relativeTime(ago(86_400), NOW, 'nl')).toBe('gisteren');
  });
});
