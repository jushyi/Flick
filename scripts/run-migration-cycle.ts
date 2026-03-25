/**
 * Full Migration Cycle Orchestrator
 *
 * Runs the complete migration pipeline in sequence, stopping on first failure:
 *   1. Reset dev Supabase (dev only)
 *   2. Auth migration (manual step with user confirmation)
 *   3. Data migration (Firestore -> Supabase)
 *   4. Storage migration (Firebase Storage -> Supabase Storage)
 *   5. Verification (cross-database comparison)
 *
 * Usage:
 *   npx tsx scripts/run-migration-cycle.ts --env dev
 *   npx tsx scripts/run-migration-cycle.ts --env prod
 *   npx tsx scripts/run-migration-cycle.ts --env dev --skip-reset --skip-auth
 *   npx tsx scripts/run-migration-cycle.ts --env dev --dry-run
 *
 * Flags:
 *   --env dev|prod    Target environment (default: dev)
 *   --skip-reset      Skip the Supabase reset step
 *   --skip-auth       Skip the auth migration step
 *   --skip-storage    Skip the storage migration step
 *   --skip-data       Skip the data migration step
 *   --dry-run         Pass --dry-run to the data migration script
 *   --help            Show usage
 */

import { execSync } from 'child_process';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function green(s: string): string { return `${C.green}${s}${C.reset}`; }
function yellow(s: string): string { return `${C.yellow}${s}${C.reset}`; }
function red(s: string): string { return `${C.red}${s}${C.reset}`; }
function bold(s: string): string { return `${C.bold}${s}${C.reset}`; }
function dim(s: string): string { return `${C.dim}${s}${C.reset}`; }

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  env: 'dev' | 'prod';
  skipReset: boolean;
  skipAuth: boolean;
  skipStorage: boolean;
  skipData: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    env: 'dev',
    skipReset: false,
    skipAuth: false,
    skipStorage: false,
    skipData: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--env':
        i++;
        if (args[i] === 'dev' || args[i] === 'prod') result.env = args[i];
        else { console.error(red(`Invalid --env: ${args[i]}`)); process.exit(1); }
        break;
      case '--skip-reset': result.skipReset = true; break;
      case '--skip-auth': result.skipAuth = true; break;
      case '--skip-storage': result.skipStorage = true; break;
      case '--skip-data': result.skipData = true; break;
      case '--dry-run': result.dryRun = true; break;
      case '--help': case '-h': result.help = true; break;
    }
  }
  return result;
}

function showHelp(): void {
  console.log(`
${bold('Migration Cycle Orchestrator')}

${bold('Usage:')}
  npx tsx scripts/run-migration-cycle.ts [options]

${bold('Options:')}
  --env dev|prod    Target environment (default: dev)
  --skip-reset      Skip the Supabase reset step
  --skip-auth       Skip the auth migration confirmation step
  --skip-storage    Skip the storage migration step
  --skip-data       Skip the data migration step
  --dry-run         Pass --dry-run to data migration (read-only)
  --help, -h        Show this help

${bold('Steps (in order):')}
  1. Reset dev Supabase (dev only, skipped for prod)
  2. Auth migration (manual confirmation)
  3. Data migration (Firestore -> Supabase)
  4. Storage migration (Firebase Storage -> Supabase Storage)
  5. Cross-database verification

${bold('Examples:')}
  npx tsx scripts/run-migration-cycle.ts --env dev
  npx tsx scripts/run-migration-cycle.ts --env dev --skip-reset --skip-auth
  npx tsx scripts/run-migration-cycle.ts --env prod
`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runStep(name: string, command: string): void {
  console.log(dim(`  $ ${command}\n`));
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(green(`\n  Step complete: ${name}\n`));
  } catch {
    console.error(red(`\n  FAILED at step: ${name}`));
    console.error(red('  Fix the issue and re-run with appropriate --skip flags.'));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const startTime = Date.now();

  console.log(bold('\n=== Migration Cycle Orchestrator ===\n'));
  console.log(dim(`Environment: ${args.env}`));
  if (args.dryRun) console.log(yellow('DRY RUN: Data migration will be read-only'));
  console.log('');

  // Prod safety check
  if (args.env === 'prod') {
    console.log(red(bold('WARNING: You are about to run against PRODUCTION.')));
    const answer = await prompt(red("Type 'yes-prod' to confirm: "));
    if (answer !== 'yes-prod') {
      console.log(yellow('Aborted.'));
      process.exit(0);
    }
    console.log('');
  }

  // Step 1: Reset (dev only)
  console.log(bold('--- Step 1/5: Reset Dev Supabase ---'));
  if (args.env === 'prod') {
    console.log(yellow('  Skipped: reset never runs against prod'));
  } else if (args.skipReset) {
    console.log(yellow('  Skipped: --skip-reset'));
  } else {
    runStep('Reset Dev Supabase', 'npx tsx scripts/reset-dev-supabase.ts');
  }

  // Step 2: Auth migration
  console.log(bold('--- Step 2/5: Auth Migration ---'));
  if (args.skipAuth) {
    console.log(yellow('  Skipped: --skip-auth'));
  } else {
    console.log('  Ensure all Firebase users have been migrated via the');
    console.log('  migrate-firebase-auth Edge Function or batch auth script.');
    const answer = await prompt('  Press Enter to continue or Ctrl+C to abort... ');
    if (answer.toLowerCase() === 'abort' || answer.toLowerCase() === 'q') {
      console.log(yellow('Aborted.'));
      process.exit(0);
    }
    console.log(green('  Auth migration confirmed.'));
  }

  // Step 3: Data migration
  console.log(bold('\n--- Step 3/5: Data Migration ---'));
  if (args.skipData) {
    console.log(yellow('  Skipped: --skip-data'));
  } else {
    const dryRunFlag = args.dryRun ? ' --dry-run' : '';
    runStep('Data Migration', `npx tsx scripts/migrate-firestore-data.ts --env ${args.env}${dryRunFlag}`);
  }

  // Step 4: Storage migration
  console.log(bold('--- Step 4/5: Storage Migration ---'));
  if (args.skipStorage) {
    console.log(yellow('  Skipped: --skip-storage'));
  } else if (args.dryRun) {
    console.log(yellow('  Skipped: dry-run mode (storage migration has no dry-run)'));
  } else {
    runStep('Storage Migration', 'npx tsx scripts/migrate-firebase-storage.ts');
  }

  // Step 5: Verification
  console.log(bold('--- Step 5/5: Cross-Database Verification ---'));
  runStep('Verification', `npx tsx scripts/verify-migration-cross-db.ts --env ${args.env}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(bold(green(`\nMigration cycle complete! All steps passed. (${elapsed}s)`)));
}

main().catch((err) => {
  console.error(red('Orchestrator error:'), err);
  process.exit(2);
});
