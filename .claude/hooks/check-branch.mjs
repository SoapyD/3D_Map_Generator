/**
 * Hook: Block commits and pushes directly to master/main.
 * Trigger: PreToolUse on Bash commands.
 */

import { readFileSync } from 'fs';

const input = JSON.parse(readFileSync(process.stdin.fd, 'utf8'));

if (input.tool_name !== 'Bash') process.exit(0);

const cmd = input.tool_input?.command || '';
const protectedBranches = ['master', 'main'];

// Check for direct commits to protected branches
for (const branch of protectedBranches) {
  // Block git commit on protected branch
  if (cmd.match(/git\s+commit/) && cmd.includes(branch)) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `BLOCKED: Cannot commit directly to ${branch}. Create a feature branch first.`
    }));
    process.exit(0);
  }

  // Block force push
  if (cmd.match(/git\s+push/) && (cmd.includes('-f') || cmd.includes('--force')) && cmd.includes(branch)) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `BLOCKED: Force push to ${branch} is not allowed.`
    }));
    process.exit(0);
  }

  // Block direct push to protected branch
  if (cmd.match(/git\s+push/) && cmd.match(new RegExp(`\\b${branch}\\b`))) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `BLOCKED: Cannot push directly to ${branch}. Use a pull request.`
    }));
    process.exit(0);
  }
}

// Allow everything else
process.exit(0);
