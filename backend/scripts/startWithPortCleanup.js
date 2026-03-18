const { execSync, spawn } = require('child_process');

const port = Number(process.env.PORT || 5000);

function findListeningPids(targetPort) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, { encoding: 'utf8' });
      const pids = new Set();

      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          if (!/LISTENING/i.test(line)) return;
          const parts = line.split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            pids.add(Number(pid));
          }
        });

      return Array.from(pids);
    }

    const output = execSync(`lsof -ti tcp:${targetPort}`, { encoding: 'utf8' });
    return output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => /^\d+$/.test(value))
      .map(Number);
  } catch (error) {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch (error) {
    return false;
  }
}

const pids = findListeningPids(port).filter((pid) => pid !== process.pid);

if (pids.length) {
  console.log(`[start] Port ${port} is in use by PID(s): ${pids.join(', ')}`);
  const killed = pids.filter(killPid);

  if (killed.length) {
    console.log(`[start] Freed port ${port} by stopping PID(s): ${killed.join(', ')}`);
  }

  const remaining = findListeningPids(port).filter((pid) => pid !== process.pid);
  if (remaining.length) {
    console.error(`[start] Could not free port ${port}. Still in use by PID(s): ${remaining.join(', ')}`);
    process.exit(1);
  }
}

const child = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('[start] Failed to launch server:', error.message);
  process.exit(1);
});
