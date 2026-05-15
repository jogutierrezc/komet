import fs from 'node:fs';
import { parse } from '@babel/parser';

const filePath = 'src/components/Estadistica.jsx';
const code = fs.readFileSync(filePath, 'utf8');

try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('OK');
} catch (err) {
  console.error('PARSE_ERROR');
  console.error(err.message);
  if (err.loc) {
    console.error(`line=${err.loc.line} column=${err.loc.column}`);
  }
}
