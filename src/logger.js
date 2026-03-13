/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFile = fs.createWriteStream(path.join(logsDir, 'hb-task-server.log'), { flags: 'a' });

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
}

function write(level, args) {
  const line = `${timestamp()} [${level}] ${args.join(' ')}`;
  logFile.write(line + '\n');
  return line;
}

const logger = {
  log(...args)   { console.log(write('INFO', args)); },
  error(...args) { console.error(write('ERROR', args)); },
  warn(...args)  { console.warn(write('WARN', args)); },
};

module.exports = logger;
