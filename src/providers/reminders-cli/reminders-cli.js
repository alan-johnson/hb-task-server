const { execSync } = require('child_process');
const path = require('path');

class RemindersCliProvider {
  constructor() {
    this.name = 'Reminders CLI';
    // Path to the reminders executable (now in same directory)
    this.cliPath = path.join(__dirname, 'reminders');
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
    const tasks = cliTasks.map((task, index) => ({
      id: task.externalId,
      name: task.title,
      completed: task.isCompleted,
      notes: task.notes || '',
      dueDate: task.dueDate || null,
      priority: task.priority,
      index: index // Store index for complete/delete operations
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
    // Need to get the task index for the CLI command
    const tasks = await this.getTasks(listId, { showCompleted: false });
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    const listName = this.listIdToName[listId] || listId;
    const taskIndex = task.index; // CLI uses 0-based indexing

    this.executeCommand(`complete "${this.escapeString(listName)}" ${taskIndex}`);

    return { success: true, message: 'Task marked as complete' };
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

    const output = this.executeCommand(args);

    // The CLI might return the created task info or just success
    // Return a basic response
    return {
      id: 'pending', // CLI doesn't return ID immediately
      name: title
    };
  }

  // Helper to escape strings for shell commands
  escapeString(str) {
    // Escape double quotes and backslashes
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

module.exports = RemindersCliProvider;
