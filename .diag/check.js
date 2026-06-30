const { spawn } = require('child_process');
try {
  if (process.env.RSPACK_NATIVE_PROBE === '1') {
    spawn('node', ['-e', '0'], { detached: true, stdio: 'ignore' }).unref();
  }
} catch (e) {}
