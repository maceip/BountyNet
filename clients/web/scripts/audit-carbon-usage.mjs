/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const REPORT_PATH = path.resolve(process.cwd(), 'reports', 'carbon-usage.json');

const HIGH_COST_COMPONENTS = new Map([
  ['ComposedModal', 8],
  ['ModalBody', 4],
  ['ModalFooter', 4],
  ['ModalHeader', 4],
  ['Tabs', 7],
  ['TabList', 4],
  ['TabPanels', 4],
  ['TabPanel', 4],
  ['Tab', 3],
  ['Table', 6],
  ['TableBody', 3],
  ['TableCell', 2],
  ['TableHead', 2],
  ['TableHeader', 2],
  ['TableRow', 2],
  ['ProgressBar', 4],
  ['ProgressIndicator', 5],
  ['ProgressStep', 3],
  ['ContainedList', 4],
  ['StructuredListWrapper', 5],
  ['StructuredListRow', 2],
  ['OverflowMenu', 4],
  ['InlineNotification', 4],
  ['CodeSnippet', 4],
  ['NumberInput', 4],
  ['Select', 3],
  ['SelectItem', 1],
  ['Slider', 4],
  ['TextArea', 3],
  ['PageHeader', 6],
  ['UserAvatar', 4],
]);

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

const walk = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walk(target);
      }
      if (sourceExtensions.has(path.extname(entry.name))) {
        return [target];
      }
      return [];
    }),
  );

  return files.flat();
};

const parseCarbonImports = (source) => {
  const matches = [
    ...source.matchAll(
      /import\s*\{([\s\S]*?)\}\s*from\s*'(@carbon\/(?:react|ibm-products))'/g,
    ),
  ];

  return matches.flatMap((match) =>
    match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.split(/\s+as\s+/)[0].trim())
      .filter((item) => item && !item.includes('\n')),
  );
};

const main = async () => {
  const files = await walk(ROOT);
  const perComponent = new Map();
  const perFile = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const imports = parseCarbonImports(source);

    if (imports.length === 0) {
      continue;
    }

    for (const name of imports) {
      perComponent.set(name, (perComponent.get(name) || 0) + 1);
    }

    const weightedCost = imports.reduce(
      (sum, name) => sum + (HIGH_COST_COMPONENTS.get(name) || 1),
      0,
    );

    perFile.push({
      file: path.relative(process.cwd(), file),
      importCount: imports.length,
      weightedCost,
      imports,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      filesWithCarbon: perFile.length,
      totalUniqueComponents: perComponent.size,
      totalImports: [...perComponent.values()].reduce(
        (sum, value) => sum + value,
        0,
      ),
    },
    topComponents: [...perComponent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count })),
    highCostFiles: perFile
      .sort(
        (a, b) =>
          b.weightedCost - a.weightedCost || b.importCount - a.importCount,
      )
      .slice(0, 20),
    recommendations: [
      'Keep Carbon-heavy composites behind route-level lazy loading.',
      'Prefer a smaller set of reusable domain composites over importing many primitives directly in pages.',
      'Audit any file with high weighted cost before adding more Carbon primitives.',
      'Treat tables, tabs, modal shells, progress systems, and large form controls as budget-sensitive imports.',
    ],
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `Carbon usage report written to ${path.relative(process.cwd(), REPORT_PATH)}`,
  );
  console.log('\nTop Carbon components:');
  for (const item of report.topComponents.slice(0, 12)) {
    console.log(`- ${item.name}: ${item.count}`);
  }

  console.log('\nHighest-cost files:');
  for (const item of report.highCostFiles.slice(0, 10)) {
    console.log(
      `- ${item.file}: weighted ${item.weightedCost}, imports ${item.importCount}`,
    );
  }
};

await main();
