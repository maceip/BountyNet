/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST_ASSETS = path.resolve(process.cwd(), 'dist', 'client', 'assets');

const BUDGETS = [
  { name: 'carbon-react', pattern: /^carbon-react-.*\.js$/, maxGzipKb: 320 },
  { name: 'react-core', pattern: /^react-core-.*\.js$/, maxGzipKb: 90 },
  {
    name: 'carbon-products',
    pattern: /^carbon-products-.*\.js$/,
    maxGzipKb: 25,
  },
  { name: 'i18n', pattern: /^i18n-.*\.js$/, maxGzipKb: 25 },
  { name: 'router', pattern: /^router-.*\.js$/, maxGzipKb: 20 },
  { name: 'main-css', pattern: /^index-.*\.css$/, maxGzipKb: 170 },
];

const gzipKb = (buffer) =>
  Number((zlib.gzipSync(buffer).length / 1024).toFixed(2));

const main = async () => {
  const entries = await fs.readdir(DIST_ASSETS);
  const report = [];
  let hasFailure = false;

  for (const budget of BUDGETS) {
    const matched = entries.find((entry) => budget.pattern.test(entry));

    if (!matched) {
      report.push({
        name: budget.name,
        status: 'missing',
        maxGzipKb: budget.maxGzipKb,
      });
      hasFailure = true;
      continue;
    }

    const absolutePath = path.join(DIST_ASSETS, matched);
    const file = await fs.readFile(absolutePath);
    const actualGzipKb = gzipKb(file);
    const status = actualGzipKb <= budget.maxGzipKb ? 'ok' : 'over';

    if (status === 'over') {
      hasFailure = true;
    }

    report.push({
      name: budget.name,
      file: matched,
      actualGzipKb,
      maxGzipKb: budget.maxGzipKb,
      status,
    });
  }

  console.log('Bundle budget report:');
  for (const item of report) {
    if (item.status === 'missing') {
      console.log(`- ${item.name}: missing`);
      continue;
    }

    console.log(
      `- ${item.name}: ${item.actualGzipKb} KiB gzip / budget ${item.maxGzipKb} KiB [${item.status}]`,
    );
  }

  if (process.argv.includes('--strict') && hasFailure) {
    process.exitCode = 1;
  }
};

await main();
