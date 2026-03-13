/**
 * Handsbreadth Task Server
 * Copyright (c) 2026 Handsbreadth Software LLC.
 * All rights reserved.
 */

const { execSync } = require('child_process');

const CACHE_TTL_MS = 30_000; // 30 seconds

class AppleRemindersProvider {
  constructor() {
    this.name = 'Apple Reminders';
    this._cache = new Map();
  }

  // ── Cache helpers ──────────────────────────────────────────────────────────

  _cacheGet(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { this._cache.delete(key); return null; }
    return entry.value;
  }

  _cacheSet(key, value) {
    this._cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  }

  // ── AppleScript execution ──────────────────────────────────────────────────

  executeAppleScript(script) {
    try {
      const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000
      });
      return result.trim();
    } catch (error) {
      if (error.killed) {
        throw new Error(`AppleScript timeout: Script took longer than 60 seconds to execute`);
      }
      throw new Error(`AppleScript error: ${error.message}`);
    }
  }

  // ── Provider methods ───────────────────────────────────────────────────────

  async getLists() {
    const cached = this._cacheGet('lists');
    if (cached) return cached;

    const script = `
      tell application "Reminders"
        set output to ""
        repeat with aList in lists
          set output to output & "LIST_START" & linefeed
          set output to output & "ID:" & id of aList & linefeed
          set output to output & "NAME:" & name of aList & linefeed
          set output to output & "LIST_END" & linefeed
        end repeat
        return output
      end tell
    `;

    const result = this.executeAppleScript(script);
    const lists = this.parseListsOutput(result);
    this._cacheSet('lists', lists);
    return lists;
  }

  async getTasks(listId, options = {}) {
    const showCompleted = options.showCompleted || false;
    const cacheKey = `tasks:${listId}:${showCompleted}`;
    const cached = this._cacheGet(cacheKey);
    if (cached) {
      const limit = options.limit || 50;
      return cached.slice(0, limit);
    }

    // Use 'whose id is' to find the list directly — avoids iterating all lists
    const filterClause = showCompleted ? '' : ' whose completed is false';

    const script = `
      tell application "Reminders"
        set output to ""
        set taskCount to 0
        set maxTasks to ${options.limit || 50}
        set targetList to first list whose id is "${listId}"
        set filteredReminders to reminders of targetList${filterClause}
        repeat with aReminder in filteredReminders
          set output to output & "TASK_START" & linefeed
          set output to output & "ID:" & id of aReminder & linefeed
          set output to output & "NAME:" & name of aReminder & linefeed
          set output to output & "COMPLETED:" & completed of aReminder & linefeed
          try
            if body of aReminder is not missing value then
              set output to output & "NOTES:" & body of aReminder & linefeed
            end if
          end try
          try
            if due date of aReminder is not missing value then
              set output to output & "DUE:" & (due date of aReminder as string) & linefeed
            end if
          end try
          set output to output & "TASK_END" & linefeed
          set taskCount to taskCount + 1
          if taskCount >= maxTasks then exit repeat
        end repeat
        return output
      end tell
    `;

    const result = this.executeAppleScript(script);
    const tasks = this.parseTasksOutput(result);
    this._cacheSet(cacheKey, tasks);
    return tasks;
  }

  async getTask(listId, taskId) {
    const script = `
      tell application "Reminders"
        set targetList to first list whose id is "${listId}"
        set output to ""
        repeat with aReminder in reminders of targetList
          if id of aReminder is "${taskId}" then
            set output to output & "ID:" & id of aReminder & linefeed
            set output to output & "NAME:" & name of aReminder & linefeed
            set output to output & "COMPLETED:" & completed of aReminder & linefeed
            try
              if body of aReminder is not missing value then
                set output to output & "NOTES:" & body of aReminder & linefeed
              end if
            end try
            try
              if due date of aReminder is not missing value then
                set output to output & "DUE:" & (due date of aReminder as string) & linefeed
              end if
            end try
            try
              if creation date of aReminder is not missing value then
                set output to output & "CREATED:" & (creation date of aReminder as string) & linefeed
              end if
            end try
            return output
          end if
        end repeat
        return ""
      end tell
    `;

    const result = this.executeAppleScript(script);
    if (!result) throw new Error('Task not found');
    return this.parseTaskDetail(result);
  }

  async completeTask(listId, taskId) {
    const script = `
      tell application "Reminders"
        set targetList to first list whose id is "${listId}"
        repeat with aReminder in reminders of targetList
          if id of aReminder is "${taskId}" then
            set completed of aReminder to true
            return "success"
          end if
        end repeat
        return "not found"
      end tell
    `;

    const result = this.executeAppleScript(script);
    if (result === 'not found') throw new Error('Task not found');
    // Invalidate task cache for this list
    this._cache.forEach((_, key) => { if (key.startsWith(`tasks:${listId}:`)) this._cache.delete(key); });
    return { success: true, message: 'Task marked as complete' };
  }

  async updateTask(listId, taskId, taskData) {
    let script = `
      tell application "Reminders"
        set targetList to first list whose id is "${listId}"
        repeat with aReminder in reminders of targetList
          if id of aReminder is "${taskId}" then
    `;

    if (taskData.name) {
      script += `\n            set name of aReminder to "${this.escapeString(taskData.name)}"`;
    }
    if (taskData.notes !== undefined) {
      script += `\n            set body of aReminder to "${this.escapeString(taskData.notes || '')}"`;
    }
    if (taskData.dueDate) {
      const [y, m, d] = taskData.dueDate.split('-');
      script += `\n            set due date of aReminder to date "${Number(m)}/${Number(d)}/${y}"`;
    }

    script += `
            return "success"
          end if
        end repeat
        return "not found"
      end tell
    `;

    const result = this.executeAppleScript(script);
    if (result === 'not found') throw new Error('Task not found');
    this._cache.forEach((_, key) => { if (key.startsWith(`tasks:${listId}:`)) this._cache.delete(key); });
    return { success: true, message: 'Task updated' };
  }

  async deleteTask(listId, taskId) {
    const script = `
      tell application "Reminders"
        set targetList to first list whose id is "${listId}"
        repeat with aReminder in reminders of targetList
          if id of aReminder is "${taskId}" then
            delete aReminder
            return "success"
          end if
        end repeat
        return "not found"
      end tell
    `;

    const result = this.executeAppleScript(script);
    if (result === 'not found') throw new Error('Task not found');
    this._cache.forEach((_, key) => { if (key.startsWith(`tasks:${listId}:`)) this._cache.delete(key); });
    return { success: true, message: 'Task deleted' };
  }

  async createTask(listId, taskData) {
    const name = taskData.name || taskData.title || 'Untitled Task';
    const notes = taskData.notes || taskData.description || '';

    let script = `
      tell application "Reminders"
        set targetList to first list whose id is "${listId}"
        set newReminder to make new reminder at targetList with properties {name:"${this.escapeString(name)}"}
    `;

    if (notes) {
      script += `\n        set body of newReminder to "${this.escapeString(notes)}"`;
    }

    script += `
        return id of newReminder
      end tell
    `;

    const result = this.executeAppleScript(script);
    // Invalidate task cache for this list
    this._cache.forEach((_, key) => { if (key.startsWith(`tasks:${listId}:`)) this._cache.delete(key); });
    return { id: result, name };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  escapeString(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  parseListsOutput(output) {
    if (!output || output.trim() === '') return [];
    const lists = [];
    for (const block of output.split('LIST_START')) {
      if (!block.includes('LIST_END')) continue;
      const list = {};
      for (const line of block.split('\n')) {
        const t = line.trim();
        if (t.startsWith('ID:'))   list.id   = t.substring(3).trim();
        if (t.startsWith('NAME:')) list.name = t.substring(5).trim();
      }
      if (list.id && list.name) lists.push(list);
    }
    return lists;
  }

  parseTasksOutput(output) {
    if (!output || output.trim() === '') return [];
    const tasks = [];
    for (const block of output.split('TASK_START')) {
      if (!block.includes('TASK_END')) continue;
      const task = {};
      for (const line of block.split('\n')) {
        const t = line.trim();
        if (t.startsWith('ID:'))        task.id        = t.substring(3).trim();
        if (t.startsWith('NAME:'))      task.name      = t.substring(5).trim();
        if (t.startsWith('COMPLETED:')) task.completed = t.substring(10).trim() === 'true';
        if (t.startsWith('NOTES:'))     task.notes     = t.substring(6).trim();
        if (t.startsWith('DUE:'))       task.dueDate   = t.substring(4).trim();
      }
      if (task.id && task.name !== undefined) tasks.push(task);
    }
    return tasks;
  }

  parseTaskDetail(output) {
    if (!output || output.trim() === '') throw new Error('Task not found');
    const task = {};
    for (const line of output.split('\n')) {
      const t = line.trim();
      if (t.startsWith('ID:'))          task.id          = t.substring(3).trim();
      if (t.startsWith('NAME:'))        task.name        = t.substring(5).trim();
      if (t.startsWith('COMPLETED:'))   task.completed   = t.substring(10).trim() === 'true';
      if (t.startsWith('NOTES:'))       task.notes       = t.substring(6).trim();
      if (t.startsWith('DUE:'))         task.dueDate     = t.substring(4).trim();
      if (t.startsWith('CREATED:'))     task.createdDate = t.substring(8).trim();
    }
    return task;
  }
}

module.exports = AppleRemindersProvider;
