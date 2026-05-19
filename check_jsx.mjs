import fs from 'fs';
import { parse } from 'acorn';
import * as acornJsx from 'acorn-jsx';

const JsxParser = parse.extend(acornJsx.default());

try {
  const code = fs.readFileSync('../UI/src/app/dashboard/student/simulation/[id]/page.js', 'utf8');
  JsxParser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  console.log('Syntax OK');
} catch (err) {
  console.error('Syntax Error:', err.message);
  process.exit(1);
}
