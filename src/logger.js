/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const FILE_PREFIX = 'hb-task-server-';
const FILE_NAME_RE = /^hb-task-server-(\d{4}-\d{2}-\d{2})\.log$/;

// LOG_RETENTION_DAYS=0 keeps every rotated file forever (no automatic cleanup).
const rawRetention = process.env.LOG_RETENTION_DAYS;
const retentionDays = rawRetention === undefined ? 14 : Number(rawRetention);
const retentionEnabled = Number.isFinite(retentionDays) && retentionDays > 0;

let currentDate = null;
let currentStream = null;

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function logFilePath(date) {
  return path.join(logsDir, `${FILE_PREFIX}${date}.log`);
}

function cleanupOldLogs() {
  if (!retentionEnabled) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let entries;
  try { entries = fs.readdirSync(logsDir); } catch { return; }
  for (const name of entries) {
    const match = name.match(FILE_NAME_RE);
    if (!match) continue;
    const fileTime = new Date(`${match[1]}T00:00:00Z`).getTime();
    if (fileTime < cutoff) {
      try { fs.unlinkSync(path.join(logsDir, name)); } catch { /* ignore */ }
    }
  }
}

// Rotates to a new file when the date changes; checked lazily on each write
// rather than with a timer, since writes only need to be correct as-of-now.
function currentLogStream() {
  const today = dateStamp(new Date());
  if (today !== currentDate) {
    if (currentStream) currentStream.end();
    currentDate = today;
    currentStream = fs.createWriteStream(logFilePath(today), { flags: 'a' });
    cleanupOldLogs();
  }
  return currentStream;
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
}

function writeToFile(level, args) {
  const line = `${timestamp()} [${level}] ${args.join(' ')}`;
  currentLogStream().write(line + '\n');
  return line;
}

const logger = {
  // Routine/verbose detail (e.g. per-request activity, expected reconnect cycling):
  // recorded to the rotating log file only, kept out of the console.
  log(...args) { writeToFile('INFO', args); },
  // Console-worthy status (startup sequence, listening, initial UpQ connection):
  // written to both the file and the console.
  status(...args) { console.log(writeToFile('INFO', args)); },
  warn(...args) { console.warn(writeToFile('WARN', args)); },
  error(...args) { console.error(writeToFile('ERROR', args)); },
};

module.exports = logger;
