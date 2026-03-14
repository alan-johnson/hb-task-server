/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

const WebSocket = require('ws');
const logger = require('./logger');

const INITIAL_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;
const HEARTBEAT_MS = 30_000;

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

  function connect() {
    logger.log(`Bridge: connecting to ${bridgeUrl}...`);
    const ws = new WebSocket(bridgeUrl);

    let heartbeat = null;

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', apiKey }));
    });

    ws.on('message', async (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'auth_ok') {
        retryDelay = INITIAL_RETRY_MS;
        logger.log('Bridge: connected to UpQ server');
        heartbeat = setInterval(() => ws.ping(), HEARTBEAT_MS);
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

    ws.on('close', () => {
      clearInterval(heartbeat);
      logger.log(`Bridge: disconnected — retrying in ${retryDelay / 1000}s`);
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    });

    ws.on('error', (err) => {
      if (err.message.includes('400')) {
        logger.warn(`Bridge: server not ready — retrying in ${retryDelay / 1000}s`);
      } else {
        logger.error('Bridge: error —', err.message);
      }
    });
  }

  connect();
}

module.exports = { startBridge };
