const { execSync } = require('child_process');

class AppleRemindersProvider {
  constructor() {
    this.name = 'Apple Reminders';
  }

  // Execute AppleScript and return result
  executeAppleScript(script) {
    try {
      const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
      return result.trim();
    } catch (error) {
      throw new Error(`AppleScript error: ${error.message}`);
    }
  }

  // Get all task lists
  async getLists() {
    const script = `
      tell application "Reminders"
        set listData to {}
        repeat with aList in lists
          set end of listData to {id:id of aList, name:name of aList}
        end repeat
        return listData
      end tell
    `;
    
    const result = this.executeAppleScript(script);
    return this.parseAppleScriptList(result);
  }

  // Get tasks from a specific list
  async getTasks(listId) {
    const script = `
      tell application "Reminders"
        set taskData to {}
        repeat with aList in lists
          if id of aList is "${listId}" then
            repeat with aReminder in reminders of aList
              set taskInfo to {id:id of aReminder, name:name of aReminder, completed:completed of aReminder}
              if body of aReminder is not missing value then
                set end of taskInfo to {notes:body of aReminder}
              end if
              if due date of aReminder is not missing value then
                set end of taskInfo to {dueDate:due date of aReminder as string}
              end if
              set end of taskData to taskInfo
            end repeat
            exit repeat
          end if
        end repeat
        return taskData
      end tell
    `;
    
    const result = this.executeAppleScript(script);
    return this.parseAppleScriptList(result);
  }

  // Get task details
  async getTask(listId, taskId) {
    const script = `
      tell application "Reminders"
        repeat with aList in lists
          if id of aList is "${listId}" then
            repeat with aReminder in reminders of aList
              if id of aReminder is "${taskId}" then
                set taskInfo to {id:id of aReminder, name:name of aReminder, completed:completed of aReminder}
                if body of aReminder is not missing value then
                  set taskNotes to body of aReminder
                else
                  set taskNotes to ""
                end if
                if due date of aReminder is not missing value then
                  set taskDue to due date of aReminder as string
                else
                  set taskDue to ""
                end if
                return "ID:" & id of aReminder & "|NAME:" & name of aReminder & "|COMPLETED:" & completed of aReminder & "|NOTES:" & taskNotes & "|DUE:" & taskDue
              end if
            end repeat
          end if
        end repeat
        return ""
      end tell
    `;
    
    const result = this.executeAppleScript(script);
    return this.parseTaskDetail(result);
  }

  // Mark task as complete
  async completeTask(listId, taskId) {
    const script = `
      tell application "Reminders"
        repeat with aList in lists
          if id of aList is "${listId}" then
            repeat with aReminder in reminders of aList
              if id of aReminder is "${taskId}" then
                set completed of aReminder to true
                return "success"
              end if
            end repeat
          end if
        end repeat
        return "not found"
      end tell
    `;
    
    const result = this.executeAppleScript(script);
    if (result === 'not found') {
      throw new Error('Task not found');
    }
    return { success: true, message: 'Task marked as complete' };
  }

  // Create a new task
  async createTask(listId, taskData) {
    const name = taskData.name || taskData.title || 'Untitled Task';
    const notes = taskData.notes || taskData.description || '';
    
    let script = `
      tell application "Reminders"
        repeat with aList in lists
          if id of aList is "${listId}" then
            set newReminder to make new reminder at aList with properties {name:"${name.replace(/"/g, '\\"')}"}
    `;
    
    if (notes) {
      script += `\n            set body of newReminder to "${notes.replace(/"/g, '\\"')}"`;
    }
    
    script += `
            return id of newReminder
          end if
        end repeat
      end tell
    `;
    
    const result = this.executeAppleScript(script);
    return { id: result, name: name };
  }

  // Parse AppleScript list output
  parseAppleScriptList(output) {
    if (!output || output === '') {
      return [];
    }
    
    // Simple parser for AppleScript records
    const items = [];
    const regex = /\{([^}]+)\}/g;
    let match;
    
    while ((match = regex.exec(output)) !== null) {
      const record = match[1];
      const item = {};
      
      // Parse key:value pairs
      const pairs = record.split(', ');
      pairs.forEach(pair => {
        const [key, ...valueParts] = pair.split(':');
        const value = valueParts.join(':').trim();
        
        if (key && value) {
          const cleanKey = key.trim();
          const cleanValue = value.replace(/^"(.*)"$/, '$1');
          
          if (cleanKey === 'completed') {
            item[cleanKey] = cleanValue === 'true';
          } else {
            item[cleanKey] = cleanValue;
          }
        }
      });
      
      items.push(item);
    }
    
    return items;
  }

  // Parse task detail output
  parseTaskDetail(output) {
    if (!output || output === '') {
      throw new Error('Task not found');
    }
    
    const parts = output.split('|');
    const task = {};
    
    parts.forEach(part => {
      const [key, value] = part.split(':', 2);
      if (key && value !== undefined) {
        if (key === 'COMPLETED') {
          task.completed = value === 'true';
        } else if (key === 'ID') {
          task.id = value;
        } else if (key === 'NAME') {
          task.name = value;
        } else if (key === 'NOTES') {
          task.notes = value;
        } else if (key === 'DUE') {
          task.dueDate = value;
        }
      }
    });
    
    return task;
  }
}

module.exports = AppleRemindersProvider;
