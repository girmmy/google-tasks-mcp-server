import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ClearCompletedTasksInputSchema,
  CompleteTaskInputSchema,
  CreateTaskInputSchema,
  DeleteTaskInputSchema,
  GetTaskInputSchema,
  ListTasksInputSchema,
  MoveTaskInputSchema,
  ReopenTaskInputSchema,
  UpdateTaskInputSchema,
  type ClearCompletedTasksInput,
  type CompleteTaskInput,
  type CreateTaskInput,
  type DeleteTaskInput,
  type GetTaskInput,
  type ListTasksInput,
  type MoveTaskInput,
  type ReopenTaskInput,
  type UpdateTaskInput,
} from "../schemas/schemas.js";
import * as client from "../services/tasksClient.js";
import { describeApiError } from "../services/tasksClient.js";
import { renderResult, taskToMarkdown, tasksToMarkdown, truncateItems } from "../format.js";

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    "google_tasks_list_tasks",
    {
      title: "List Google Tasks",
      description: `List tasks in a Google Task list, optionally filtered by due date or last-updated time.

Args:
  - tasklist_id (string): ID of the task list, or '@default' for the default list (default: '@default')
  - limit (number): Max tasks to return, 1-100 (default: 20)
  - page_token (string, optional): Pagination token from a previous response
  - show_completed (boolean): Include completed tasks (default: true)
  - show_deleted (boolean): Include deleted tasks (default: false)
  - show_hidden (boolean): Include hidden tasks, i.e. completed tasks that were cleared (default: false)
  - due_min / due_max (RFC 3339 string, optional): Filter by due date range
  - updated_min (RFC 3339 string, optional): Only tasks modified on/after this time
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns each task's id, title, status, due date (if any), and notes, plus pagination info.

Examples:
  - Use when: "What's on my to-do list?" -> tasklist_id='@default'
  - Use when: "What's due this week in my Groceries list?" -> set due_min/due_max
  - Don't use when: You need every list's tasks — call google_tasks_list_tasklists first, then this per list.

Error Handling:
  - Returns "Error: Not found (404)" if tasklist_id doesn't exist.`,
      inputSchema: ListTasksInputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ListTasksInput) => {
      try {
        const { items, nextPageToken } = await client.listTasks({
          taskListId: params.tasklist_id,
          maxResults: params.limit,
          pageToken: params.page_token,
          showCompleted: params.show_completed,
          showDeleted: params.show_deleted,
          showHidden: params.show_hidden,
          dueMin: params.due_min,
          dueMax: params.due_max,
          updatedMin: params.updated_min,
        });
        const { text: mdBody, truncated, returnedCount } = truncateItems(items, (i) => tasksToMarkdown(i));
        const json = {
          count: returnedCount,
          tasks: items.slice(0, returnedCount),
          has_more: Boolean(nextPageToken) || truncated,
          ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
          ...(truncated ? { truncation_message: "Response truncated; narrow with a smaller limit or filters." } : {}),
        };
        return renderResult(params.response_format, json, mdBody);
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_get_task",
    {
      title: "Get Google Task",
      description: `Fetch full details for a single task by ID.

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')
  - task_id (string): ID of the task (from google_tasks_list_tasks)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the task's title, status, due date, notes, completion time, and parent (if a subtask).

Error Handling:
  - Returns "Error: Not found (404)" if task_id doesn't exist in that list.`,
      inputSchema: GetTaskInputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: GetTaskInput) => {
      try {
        const task = await client.getTask(params.tasklist_id, params.task_id);
        return renderResult(params.response_format, task, taskToMarkdown(task));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_create_task",
    {
      title: "Create Google Task",
      description: `Create a new task in a Google Task list.

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')
  - title (string): Task title
  - notes (string, optional): Free-text description
  - due (RFC 3339 string, optional): Due date, e.g. '2026-09-10T00:00:00Z' (Google Tasks stores date only, not time)
  - parent_task_id (string, optional): Create as a subtask of this task
  - previous_task_id (string, optional): Place this task after the given task in list order
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the newly created task including its id.

Examples:
  - Use when: "Add 'buy milk' to my grocery list"
  - Use when: "Add a subtask 'draft outline' under my 'Write report' task" -> set parent_task_id`,
      inputSchema: CreateTaskInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: CreateTaskInput) => {
      try {
        const task = await client.createTask({
          taskListId: params.tasklist_id,
          title: params.title,
          notes: params.notes,
          due: params.due,
          parent: params.parent_task_id,
          previous: params.previous_task_id,
        });
        return renderResult(params.response_format, task, taskToMarkdown(task));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_update_task",
    {
      title: "Update Google Task",
      description: `Update an existing task's title, notes, due date, and/or status. Only fields you provide are changed.

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')
  - task_id (string): ID of the task to update
  - title (string, optional): New title
  - notes (string, optional): New notes (pass '' to clear)
  - due (RFC 3339 string or null, optional): New due date, or null to clear it
  - status ('needsAction' | 'completed', optional): New status — prefer google_tasks_complete_task/reopen_task instead
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the updated task.

Don't use when: You only want to mark a task done/not-done — use google_tasks_complete_task or
google_tasks_reopen_task, which are more explicit about intent.

Error Handling:
  - Returns a validation error if no fields are provided to update.
  - Returns "Error: Not found (404)" if task_id doesn't exist.`,
      inputSchema: UpdateTaskInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: UpdateTaskInput) => {
      if (
        params.title === undefined &&
        params.notes === undefined &&
        params.due === undefined &&
        params.status === undefined
      ) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Provide at least one field to update (title, notes, due, or status).",
            },
          ],
        };
      }
      try {
        const task = await client.updateTask({
          taskListId: params.tasklist_id,
          taskId: params.task_id,
          title: params.title,
          notes: params.notes,
          due: params.due,
          status: params.status,
        });
        return renderResult(params.response_format, task, taskToMarkdown(task));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_complete_task",
    {
      title: "Complete Google Task",
      description: `Mark a task as completed.

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')
  - task_id (string): ID of the task to complete
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the updated task with status='completed' and a completion timestamp.

Examples:
  - Use when: "Mark 'buy milk' as done"`,
      inputSchema: CompleteTaskInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: CompleteTaskInput) => {
      try {
        const task = await client.updateTask({
          taskListId: params.tasklist_id,
          taskId: params.task_id,
          status: "completed",
        });
        return renderResult(params.response_format, task, taskToMarkdown(task));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_reopen_task",
    {
      title: "Reopen Google Task",
      description: `Mark a completed task as not-done (status back to 'needsAction').

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')
  - task_id (string): ID of the task to reopen
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the updated task with status='needsAction'.`,
      inputSchema: ReopenTaskInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ReopenTaskInput) => {
      try {
        const task = await client.updateTask({
          taskListId: params.tasklist_id,
          taskId: params.task_id,
          status: "needsAction",
        });
        return renderResult(params.response_format, task, taskToMarkdown(task));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_delete_task",
    {
      title: "Delete Google Task",
      description: `Permanently delete a single task. This cannot be undone.

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')
  - task_id (string): ID of the task to delete

Returns a confirmation message.

Don't use when: You want to remove all completed tasks at once — use google_tasks_clear_completed_tasks instead.

Error Handling:
  - Returns "Error: Not found (404)" if task_id doesn't exist.`,
      inputSchema: DeleteTaskInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params: DeleteTaskInput) => {
      try {
        await client.deleteTask(params.tasklist_id, params.task_id);
        return {
          content: [{ type: "text" as const, text: `Deleted task \`${params.task_id}\`.` }],
          structuredContent: { deleted: true, task_id: params.task_id, tasklist_id: params.tasklist_id },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_move_task",
    {
      title: "Move/Reorder Google Task",
      description: `Reorder a task within its list, nest/un-nest it under a parent task, or move it to a different task list.

Args:
  - tasklist_id (string): ID of the task's current task list, or '@default' (default: '@default')
  - task_id (string): ID of the task to move
  - parent_task_id (string, optional): New parent task ID, to nest as a subtask
  - previous_task_id (string, optional): Place after this task in the new position
  - destination_tasklist_id (string, optional): Move the task into a different task list entirely
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the moved task with its new position/parent.

Examples:
  - Use when: "Move 'call dentist' to the top of my list" -> omit previous_task_id
  - Use when: "Move this task to my Work list" -> set destination_tasklist_id

Error Handling:
  - Returns "Error: Not found (404)" if task_id, parent_task_id, or destination_tasklist_id doesn't exist.`,
      inputSchema: MoveTaskInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: MoveTaskInput) => {
      try {
        const task = await client.moveTask({
          taskListId: params.tasklist_id,
          taskId: params.task_id,
          parent: params.parent_task_id,
          previous: params.previous_task_id,
          destinationTaskList: params.destination_tasklist_id,
        });
        return renderResult(params.response_format, task, taskToMarkdown(task));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_clear_completed_tasks",
    {
      title: "Clear Completed Google Tasks",
      description: `Clear all completed tasks from a task list. Cleared tasks are hidden from the default view
(they become 'hidden' and won't reappear unless show_hidden=true is passed to google_tasks_list_tasks).
This does not delete incomplete tasks.

Args:
  - tasklist_id (string): ID of the task list, or '@default' (default: '@default')

Returns a confirmation message.

Examples:
  - Use when: "Clear out everything I've already finished on my to-do list"`,
      inputSchema: ClearCompletedTasksInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params: ClearCompletedTasksInput) => {
      try {
        await client.clearCompletedTasks(params.tasklist_id);
        return {
          content: [
            { type: "text" as const, text: `Cleared completed tasks from task list \`${params.tasklist_id}\`.` },
          ],
          structuredContent: { cleared: true, tasklist_id: params.tasklist_id },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );
}
