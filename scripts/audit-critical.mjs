import { spawnSync } from 'node:child_process';

// Do not dismiss advisories or suppress other severities. Fail closed if the
// registry cannot be audited; only the exit-code threshold is critical.
const result = spawnSync('pnpm', ['audit', '--json'], {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  timeout: 120_000, cwd: new URL('..', import.meta.url),
});
try {
  if (result.error) throw result.error;
  const start = result.stdout.indexOf('{');
  if (start < 0) throw new Error('Registry audit returned no JSON');
  const audit = JSON.parse(result.stdout.slice(start));
  const counts = audit.metadata?.vulnerabilities;
  if (!counts || !Number.isInteger(counts.critical)) throw new Error('Registry audit returned no vulnerability counts');
  console.log('Dependency audit (all severities):', JSON.stringify(counts));
  for (const advisory of Object.values(audit.advisories ?? {})) {
    if (advisory.severity === 'critical') {
      console.error(advisory.module_name, advisory.github_advisory_id, advisory.url);
    }
  }
  console.log('High/moderate/low findings remain visible; zero critical does not mean zero vulnerabilities.');
  process.exitCode = counts.critical > 0 ? 1 : 0;
} catch (error) {
  console.error('Security audit unavailable; cannot confirm safety:', error.message);
  process.exitCode = 2;
}
