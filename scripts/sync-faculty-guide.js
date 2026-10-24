// Rewrites src/modules/ai/faculty-guide.ts from docs/faculty-guide.md, so
// nobody edits the string by hand. Run with: npm run guide:sync
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'docs', 'faculty-guide.md');
const target = path.join(root, 'src', 'modules', 'ai', 'faculty-guide.ts');

const lines = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n').split('\n');

const out = [
  '// GENERATED from docs/faculty-guide.md by scripts/sync-faculty-guide.js.',
  '// Edit the Markdown file, then run `npm run guide:sync`. Do not edit by hand.',
  '',
  'export const FACULTY_GUIDE = [',
  ...lines.map((line) => `  ${JSON.stringify(line)},`),
  "].join('\\n');",
  '',
].join('\n');

fs.writeFileSync(target, out);
console.log(`Wrote ${path.relative(root, target)} (${lines.length} lines)`);
