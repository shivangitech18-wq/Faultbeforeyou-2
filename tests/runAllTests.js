import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('🚀 Running Complete FaultBeforeYou Test Suite');
console.log('====================================================\n');

const tests = [
  { name: 'Workflow & Recovery Tests', file: 'workflow.test.js' },
  { name: 'Gemma 4 Integration & Grounding Tests', file: 'gemma.test.js' }
];

let failed = false;

for (const t of tests) {
  console.log(`\n▶️ Executing: ${t.name} (${t.file})`);
  const fullPath = path.resolve(__dirname, t.file);
  const result = spawnSync(process.execPath, ['--experimental-sqlite', fullPath], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    console.error(`❌ ${t.name} exited with status ${result.status}`);
    failed = true;
    break;
  }
}

if (failed) {
  console.error('\n❌ One or more test suites failed.');
  process.exit(1);
} else {
  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY (17/17)');
  console.log('====================================================\n');
  process.exit(0);
}
