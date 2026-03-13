/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class RemindersCliProvider {
  constructor() {
    this.name = 'Reminders CLI';
    // The reminders binary lives at providers/reminders-cli/reminders
    // relative to the running executable (SEA binary or node process).
    // esbuild rewrites __dirname to the bundle location, so we resolve
    // relative to the executable directory in all cases.
    const execDir = path.dirname(process.execPath);
    const seaPath = path.join(execDir, 'providers', 'reminders-cli', 'reminders');
    const devPath = path.join(__dirname, 'reminders');
    this.cliPath = fs.existsSync(seaPath) ? seaPath : devPath;
    // Cache list names to IDs mapping (CLI uses names, API uses IDs)
    this.listNameToId = {};
    this.listIdToName = {};
  }

  // Execute reminders CLI command and return parsed JSON result
  executeCommand(args) {
    try {
      const command = `"${this.cliPath}" ${args}`;
      const result = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000 // 60 second timeout
      });
      return result.trim();
    } catch (error) {
      if (error.killed) {
        throw new Error(`Reminders CLI timeout: Command took longer than 60 seconds to execute`);
      }
      throw new Error(`Reminders CLI error: ${error.message}`);
    }
  }

  // Get all task lists
  async getLists() {
    const output = this.executeCommand('show-lists --format json');
    const listNames = JSON.parse(output);

    // Convert list names to the format expected by the API
    // Use list name as both ID and name (CLI doesn't provide separate IDs)
    const lists = listNames.map(name => {
      // Store in cache for reverse lookup
      this.listNameToId[name] = name;
      this.listIdToName[name] = name;

      return {
        id: name,
        name: name
      };
    });

    return lists;
  }

  // Get tasks from a specific list
  async getTasks(listId, options = {}) {
    // CLI uses list names, not IDs
    const listName = this.listIdToName[listId] || listId;

    // Build command with options
    let args = `show "${this.escapeString(listName)}" --format json`;

    // Add options if specified
    if (options.showCompleted) {
      args += ' --include-completed';
    }

    const output = this.executeCommand(args);

    if (!output || output.trim() === '[]') {
      return [];
    }

    const cliTasks = JSON.parse(output);

    // Convert CLI format to API format
    const tasks = cliTasks.map((task) => ({
      id: task.externalId,
      name: task.title,
      completed: task.isCompleted,
      notes: task.notes || '',
      dueDate: task.dueDate || null,
      priority: task.priority
    }));

    // Apply limit if specified
    if (options.limit && tasks.length > options.limit) {
      return tasks.slice(0, options.limit);
    }

    return tasks;
  }

  // Get task details (not directly supported by CLI, so fetch all and find by ID)
  async getTask(listId, taskId) {
    const tasks = await this.getTasks(listId, { showCompleted: true });
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  // Mark task as complete
  async completeTask(listId, taskId) {
    const listName = this.listIdToName[listId] || listId;
    this.executeCommand(`complete "${this.escapeString(listName)}" ${taskId}`);
    return { success: true, message: 'Task marked as complete' };
  }

  // Update a task's name and/or notes (CLI does not support changing due date)
  async updateTask(listId, taskId, taskData) {
    const listName = this.listIdToName[listId] || listId;

    let args = `edit "${this.escapeString(listName)}" ${taskId}`;

    if (taskData.name) {
      args += ` "${this.escapeString(taskData.name)}"`;
    }

    if (taskData.notes) {
      args += ` --notes "${this.escapeString(taskData.notes)}"`;
    }

    this.executeCommand(args);

    // CLI edit doesn't support priority or due date — use AppleScript for those
    const needsAppleScript = taskData.priority !== undefined || taskData.dueDate;
    if (needsAppleScript) {
      let script = `
        tell application "Reminders"
          set targetList to first list whose name is "${listName.replace(/"/g, '\\"')}"
          repeat with aReminder in reminders of targetList
            if id of aReminder is "x-apple-reminder://${taskId}" then
      `;
      if (taskData.priority !== undefined) {
        script += `\n              set priority of aReminder to ${this._priorityToInt(taskData.priority)}`;
      }
      if (taskData.dueDate) {
        const [y, m, d] = taskData.dueDate.split('-');
        script += `\n              set due date of aReminder to date "${Number(m)}/${Number(d)}/${y}"`;
      }
      script += `
              exit repeat
            end if
          end repeat
        end tell
      `;
      execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf-8', timeout: 30000 });
    }

    return { success: true, message: 'Task updated' };
  }

  // Delete a task
  async deleteTask(listId, taskId) {
    const listName = this.listIdToName[listId] || listId;
    this.executeCommand(`delete "${this.escapeString(listName)}" ${taskId}`);
    return { success: true, message: 'Task deleted' };
  }

  // Create a new task
  async createTask(listId, taskData) {
    const listName = this.listIdToName[listId] || listId;
    const title = taskData.name || taskData.title || 'Untitled Task';

    let args = `add "${this.escapeString(listName)}" "${this.escapeString(title)}"`;

    // Add optional parameters
    if (taskData.notes) {
      args += ` --notes "${this.escapeString(taskData.notes)}"`;
    }

    if (taskData.dueDate) {
      args += ` --due-date "${this.escapeString(taskData.dueDate)}"`;
    }

    if (taskData.priority !== undefined) {
      args += ` --priority ${taskData.priority}`;
    }

    args += ' --format json';

    this.executeCommand(args);

    // The CLI doesn't return usable task info on create
    return {
      id: 'pending', // CLI doesn't return ID immediately
      name: title
    };
  }

  _priorityToInt(priority) {
    return { none: 0, high: 1, medium: 5, low: 9 }[priority] ?? 0;
  }

  // Helper to escape strings for shell commands
  escapeString(str) {
    // Escape double quotes and backslashes
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

module.exports = RemindersCliProvider;
