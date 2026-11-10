import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('mockServiceWorker.js', () => {
  it('embeds the installed msw version', () => {
    const worker = readFileSync(resolve('public/mockServiceWorker.js'), 'utf8');
    const embedded = /const PACKAGE_VERSION = '([^']+)'/.exec(worker)?.[1];
    const installed = (
      JSON.parse(readFileSync(resolve('node_modules/msw/package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    expect(embedded).toBe(installed);
  });
});
