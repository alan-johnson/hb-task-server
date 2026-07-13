/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const logger = require('./logger');

const INITIAL_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;
const HEARTBEAT_MS = 30_000;

// Connections that lasted at least this long before closing are treated as a routine
// server-side cycle (hosting/CDN recycling the socket) rather than a real problem —
// our own heartbeat would have caught a truly dead connection well before this.
const ROUTINE_CONNECTION_MS = 2 * 60_000;

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return `${Math.round(totalSeconds / 60)}m`;
}

// Method dispatch table: maps bridge method names to provider calls
const METHODS = {
  getLists:     (p, _)      => p.getLists(),
  getTasks:     (p, params) => p.getTasks(params.listId, params.options),
  getTask:      (p, params) => p.getTask(params.listId, params.taskId),
  createTask:   (p, params) => p.createTask(params.listId, params.taskData),
  updateTask:   (p, params) => p.updateTask(params.listId, params.taskId, params.taskData),
  completeTask: (p, params) => p.completeTask(params.listId, params.taskId),
  deleteTask:   (p, params) => p.deleteTask(params.listId, params.taskId),

  // getListCounts: fall back to per-list enumeration if the provider doesn't support it
  getListCounts: async (p, params) => {
    if (typeof p.getListCounts === 'function') {
      return p.getListCounts(params.onlyIncomplete);
    }
    const lists = await p.getLists();
    const counts = {};
    for (const list of lists) {
      const tasks = await p.getTasks(list.id, { showCompleted: true });
      counts[list.id] = params.onlyIncomplete
        ? tasks.filter(t => !t.completed).length
        : tasks.length;
    }
    return counts;
  },
};

function startBridge(providers) {
  const bridgeUrl = process.env.BRIDGE_URL;
  const apiKey    = process.env.BRIDGE_API_KEY;

  if (!bridgeUrl || !apiKey) return;

  const providerName = process.env.DEFAULT_PROVIDER || 'apple';
  const provider = providers[providerName];
  let retryDelay = INITIAL_RETRY_MS;
  // Only the first connection of the process is console-worthy; reconnect cycling
  // afterward (routine or not) is recorded to the log file but kept off the console.
  let hasConnectedBefore = false;

  // Fire-and-forget HTTP ping to wake a sleeping server (e.g. Passenger on shared hosting).
  // WebSocket upgrades don't trigger a wake-up on Passenger; a regular HTTP request does.
  function wakeServer() {
    try {
      const url = new URL(bridgeUrl.replace(/^ws/, 'http'));
      url.pathname = '/health';
      const client = url.protocol === 'https:' ? https : http;
      const req = client.get(url.toString(), (res) => res.resume());
      req.on('error', () => {});
      req.setTimeout(10_000, () => req.destroy());
    } catch { /* ignore */ }
  }

  function connect() {
    (hasConnectedBefore ? logger.log : logger.status)(`Bridge: connecting to ${bridgeUrl}...`);
    const ws = new WebSocket(bridgeUrl);

    let heartbeat = null;
    let authenticated = false;
    let pongReceived = true;
    let got400 = false;
    let connectedAt = null;

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', apiKey }));
    });

    ws.on('pong', () => { pongReceived = true; });

    ws.on('message', async (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'auth_ok') {
        authenticated = true;
        retryDelay = INITIAL_RETRY_MS;
        connectedAt = Date.now();
        (hasConnectedBefore ? logger.log : logger.status)('Bridge: connected to UpQ server');
        hasConnectedBefore = true;
        heartbeat = setInterval(() => {
          if (!pongReceived) { ws.terminate(); return; }
          pongReceived = false;
          ws.ping();
        }, HEARTBEAT_MS);
        return;
      }

      if (msg.type === 'auth_error') {
        logger.error('Bridge: authentication failed —', msg.error, '— check BRIDGE_API_KEY in .env');
        ws.close();
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'request') {
        const { id, method, params } = msg;
        const handler = METHODS[method];

        if (!handler) {
          ws.send(JSON.stringify({ type: 'response', id, error: `Unknown method: ${method}` }));
          return;
        }

        try {
          const result = await handler(provider, params || {});
          ws.send(JSON.stringify({ type: 'response', id, result }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'response', id, error: err.message }));
        }
      }
    });

    ws.on('close', (code, reason) => {
      clearInterval(heartbeat);
      const reasonText = reason && reason.length ? reason.toString() : '(no reason given)';
      const uptimeMs = connectedAt ? Date.now() - connectedAt : 0;

      if (authenticated && uptimeMs >= ROUTINE_CONNECTION_MS) {
        // Connection was healthy and our heartbeat was answering right up until this
        // close — most likely the hosting/CDN layer cycling the socket on its own
        // schedule, not a local network issue. Log plainly so it doesn't read as an error.
        logger.log(`Bridge: server closed the connection after ${formatDuration(uptimeMs)} (code=${code} reason=${reasonText}) — reconnecting in ${retryDelay / 1000}s`);
      } else if (authenticated) {
        logger.warn(`Bridge: disconnected after only ${formatDuration(uptimeMs)} — code=${code} reason=${reasonText} — retrying in ${retryDelay / 1000}s (if this keeps happening quickly, there may be a real connectivity issue)`);
      } else {
        logger.warn(`Bridge: connection failed — code=${code} reason=${reasonText} — retrying in ${retryDelay / 1000}s`);
      }

      if (got400) wakeServer();
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    });

    ws.on('error', (err) => {
      logger.error('Bridge: error —', err.message);
      if (err.message.includes('400')) got400 = true;
    });
  }

  connect();
}

module.exports = { startBridge };
