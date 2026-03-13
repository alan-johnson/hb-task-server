/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const AppleRemindersProvider = require('./providers/apple/apple');
const RemindersCliProvider = require('./providers/reminders-cli/reminders-cli');
const { startBridge } = require('./bridge');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Provider instances
const providers = {
  apple: new AppleRemindersProvider(),
  'reminders-cli': new RemindersCliProvider()
};

// Helper to get provider
function getProvider(req) {
  const providerName = req.query.provider || req.body.provider || process.env.DEFAULT_PROVIDER || 'apple';
  const provider = providers[providerName.toLowerCase()];

  if (!provider) {
    throw new Error(`Invalid provider: ${providerName}`);
  }

  return { provider, providerName };
}

// ============================================
// API Routes
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available providers
app.get('/api/providers', (req, res) => {
  res.json({
    providers: ['apple', 'reminders-cli'],
    default: process.env.DEFAULT_PROVIDER || 'apple'
  });
});

// ============================================
// Task Lists Routes
// ============================================

// Get all task lists
app.get('/api/lists', async (req, res) => {
  try {
    const { provider, providerName } = getProvider(req);
    const lists = await provider.getLists();
    res.json({
      provider: providerName,
      lists
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Tasks Routes
// ============================================

// Get all tasks in a list
app.get('/api/lists/:listId/tasks', async (req, res) => {
  try {
    const { listId } = req.params;
    const { provider, providerName } = getProvider(req);

    // Get query parameters for filtering
    const options = {
      showCompleted: req.query.showCompleted === 'true',
      limit: parseInt(req.query.limit) || 50
    };

    const tasks = await provider.getTasks(listId, options);
    logger.log(`Fetched ${tasks.length} tasks for list ${listId} from provider ${providerName}`);
    res.json({
      provider: providerName,
      listId,
      count: tasks.length,
      limit: options.limit,
      showCompleted: options.showCompleted,
      tasks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task details
app.get('/api/lists/:listId/tasks/:taskId', async (req, res) => {
  try {
    const { listId, taskId } = req.params;
    const { provider, providerName } = getProvider(req);
    const task = await provider.getTask(listId, taskId);
    res.json({
      provider: providerName,
      listId,
      task
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new task
app.post('/api/lists/:listId/tasks', async (req, res) => {
  try {
    const { listId } = req.params;
    const taskData = req.body;
    const { provider, providerName } = getProvider(req);
    const task = await provider.createTask(listId, taskData);
    res.status(201).json({
      provider: providerName,
      listId,
      task
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark task as complete
app.patch('/api/lists/:listId/tasks/:taskId/complete', async (req, res) => {
  try {
    const { listId, taskId } = req.params;
    const { provider, providerName } = getProvider(req);
    const result = await provider.completeTask(listId, taskId);
    res.json({
      provider: providerName,
      listId,
      taskId,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Error handling
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ============================================
// Start server
// ============================================

app.listen(PORT, () => {
  startBridge(providers);
  logger.log(`Task Server running on http://localhost:${PORT}`);
  logger.log(`Default provider: ${process.env.DEFAULT_PROVIDER || 'apple'}`);
  logger.log('\nAvailable endpoints:');
  logger.log('  GET  /health');
  logger.log('  GET  /api/providers');
  logger.log('  GET  /api/lists?provider=apple|reminders-cli');
  logger.log('  GET  /api/lists/:listId/tasks');
  logger.log('  GET  /api/lists/:listId/tasks/:taskId');
  logger.log('  POST /api/lists/:listId/tasks');
  logger.log('  PATCH /api/lists/:listId/tasks/:taskId/complete');
});
