import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CreateTaskListInputSchema,
  DeleteTaskListInputSchema,
  GetTaskListInputSchema,
  ListTaskListsInputSchema,
  UpdateTaskListInputSchema,
  type CreateTaskListInput,
  type DeleteTaskListInput,
  type GetTaskListInput,
  type ListTaskListsInput,
  type UpdateTaskListInput,
} from "../schemas/schemas.js";
import * as client from "../services/tasksClient.js";
import { describeApiError } from "../services/tasksClient.js";
import { renderResult, taskListToMarkdown, taskListsToMarkdown, truncateItems } from "../format.js";

export function registerTaskListTools(server: McpServer): void {
  server.registerTool(
    "google_tasks_list_tasklists",
    {
      title: "List Google Task Lists",
      description: `List all of the user's Google Task lists (the top-level containers tasks live in, shown as separate lists in the Google Tasks UI).

Args:
  - limit (number): Max task lists to return, 1-100 (default: 20)
  - page_token (string, optional): Pagination token from a previous response's next_page_token
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns task list id + title for each list, plus pagination info (has_more, next_page_token).

Examples:
  - Use when: "What task lists do I have?" or before creating/looking up a task, to find its tasklist_id.

Error Handling:
  - Returns "Error: ..." with guidance if authorization is missing or expired (run \`npm run auth\`).`,
      inputSchema: ListTaskListsInputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ListTaskListsInput) => {
      try {
        const { items, nextPageToken } = await client.listTaskLists({
          maxResults: params.limit,
          pageToken: params.page_token,
        });
        const { text: mdBody, truncated, returnedCount } = truncateItems(items, taskListsToMarkdown);
        const json = {
          count: returnedCount,
          task_lists: items.slice(0, returnedCount),
          has_more: Boolean(nextPageToken) || truncated,
          ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
          ...(truncated ? { truncation_message: "Response truncated; narrow with a smaller limit." } : {}),
        };
        return renderResult(params.response_format, json, mdBody);
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_get_tasklist",
    {
      title: "Get Google Task List",
      description: `Fetch metadata for a single Google Task list by ID.

Args:
  - tasklist_id (string): ID of the task list (from google_tasks_list_tasklists)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the task list's id, title, and last-updated time.

Error Handling:
  - Returns "Error: Not found (404)" if the tasklist_id doesn't exist.`,
      inputSchema: GetTaskListInputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: GetTaskListInput) => {
      try {
        const list = await client.getTaskList(params.tasklist_id);
        return renderResult(params.response_format, list, taskListToMarkdown(list));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_create_tasklist",
    {
      title: "Create Google Task List",
      description: `Create a new Google Task list (a new top-level container, e.g. "Work" or "Groceries").

Args:
  - title (string): Title for the new list
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the newly created task list's id and title. Use the returned id as tasklist_id in other tools.

Examples:
  - Use when: "Make me a new task list called Home Renovation"
  - Don't use when: You just want to add a task to an existing list (use google_tasks_create_task instead).`,
      inputSchema: CreateTaskListInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: CreateTaskListInput) => {
      try {
        const list = await client.createTaskList(params.title);
        return renderResult(params.response_format, list, taskListToMarkdown(list));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_update_tasklist",
    {
      title: "Rename Google Task List",
      description: `Rename an existing Google Task list.

Args:
  - tasklist_id (string): ID of the task list to rename
  - title (string): New title
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns the updated task list.

Error Handling:
  - Returns "Error: Not found (404)" if tasklist_id doesn't exist.`,
      inputSchema: UpdateTaskListInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: UpdateTaskListInput) => {
      try {
        const list = await client.updateTaskList(params.tasklist_id, params.title);
        return renderResult(params.response_format, list, taskListToMarkdown(list));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "google_tasks_delete_tasklist",
    {
      title: "Delete Google Task List",
      description: `Permanently delete a Google Task list AND all tasks in it. This cannot be undone and cannot target the '@default' list.

Args:
  - tasklist_id (string): ID of the task list to delete (must not be '@default')

Returns a confirmation message.

Error Handling:
  - Returns "Error: Invalid request (400)" if you try to delete the default list.
  - Returns "Error: Not found (404)" if tasklist_id doesn't exist.`,
      inputSchema: DeleteTaskListInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params: DeleteTaskListInput) => {
      try {
        await client.deleteTaskList(params.tasklist_id);
        return {
          content: [{ type: "text" as const, text: `Deleted task list \`${params.tasklist_id}\` and all of its tasks.` }],
          structuredContent: { deleted: true, tasklist_id: params.tasklist_id },
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: describeApiError(error) }] };
      }
    }
  );
}
