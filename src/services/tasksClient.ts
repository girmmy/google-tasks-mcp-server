import { google, tasks_v1 } from "googleapis";
import { GaxiosError } from "gaxios";
import { getAuthorizedClient } from "../auth.js";
import type { TaskListSummary, TaskSummary } from "../types.js";

let cachedClient: tasks_v1.Tasks | null = null;

/** Lazily builds (and caches) the authorized Google Tasks API client for this process. */
function getTasksApi(): tasks_v1.Tasks {
  if (!cachedClient) {
    const auth = getAuthorizedClient();
    cachedClient = google.tasks({ version: "v1", auth });
  }
  return cachedClient;
}

/** Maps a googleapis/gaxios error into a clear, actionable message for the agent. */
export function describeApiError(error: unknown): string {
  if (error instanceof GaxiosError) {
    const status = error.response?.status;
    const apiMessage =
      (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    switch (status) {
      case 401:
        return (
          "Error: Google rejected the credentials (401). The cached token may be expired or revoked. " +
          "Run `npm run auth` again to re-authorize."
        );
      case 403:
        return (
          `Error: Permission denied (403)${apiMessage ? `: ${apiMessage}` : ""}. ` +
          "Check that the Tasks API is enabled for your Google Cloud project and that you granted the " +
          "tasks scope during authorization."
        );
      case 404:
        return (
          "Error: Not found (404). The task list or task ID doesn't exist or was already deleted. " +
          "Double check the ID, e.g. via google_tasks_list_tasklists or google_tasks_list_tasks."
        );
      case 400:
        return `Error: Invalid request (400)${apiMessage ? `: ${apiMessage}` : ""}.`;
      case 429:
        return "Error: Rate limit exceeded (429). Wait a moment before retrying.";
      default:
        if (status && status >= 500) {
          return `Error: Google Tasks API is having issues (${status}). Try again shortly.`;
        }
        return `Error: Google Tasks API request failed${status ? ` (${status})` : ""}${
          apiMessage ? `: ${apiMessage}` : ""
        }.`;
    }
  }
  return `Error: Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

function toTaskListSummary(item: tasks_v1.Schema$TaskList): TaskListSummary {
  return {
    id: item.id ?? "",
    title: item.title ?? "(untitled)",
    ...(item.updated ? { updated: item.updated } : {}),
  };
}

function toTaskSummary(item: tasks_v1.Schema$Task): TaskSummary {
  return {
    id: item.id ?? "",
    title: item.title ?? "(untitled)",
    status: item.status === "completed" ? "completed" : "needsAction",
    ...(item.notes ? { notes: item.notes } : {}),
    ...(item.due ? { due: item.due } : {}),
    ...(item.completed ? { completed: item.completed } : {}),
    ...(item.parent ? { parent: item.parent } : {}),
    ...(item.position ? { position: item.position } : {}),
    ...(item.deleted ? { deleted: item.deleted } : {}),
    ...(item.hidden ? { hidden: item.hidden } : {}),
    ...(item.updated ? { updated: item.updated } : {}),
    ...(item.webViewLink ? { webViewLink: item.webViewLink } : {}),
  };
}

// ---- Task lists -----------------------------------------------------------

export async function listTaskLists(params: {
  maxResults: number;
  pageToken?: string;
}): Promise<{ items: TaskListSummary[]; nextPageToken?: string }> {
  const api = getTasksApi();
  const res = await api.tasklists.list({
    maxResults: params.maxResults,
    pageToken: params.pageToken,
  });
  return {
    items: (res.data.items ?? []).map(toTaskListSummary),
    ...(res.data.nextPageToken ? { nextPageToken: res.data.nextPageToken } : {}),
  };
}

export async function getTaskList(taskListId: string): Promise<TaskListSummary> {
  const api = getTasksApi();
  const res = await api.tasklists.get({ tasklist: taskListId });
  return toTaskListSummary(res.data);
}

export async function createTaskList(title: string): Promise<TaskListSummary> {
  const api = getTasksApi();
  const res = await api.tasklists.insert({ requestBody: { title } });
  return toTaskListSummary(res.data);
}

export async function updateTaskList(taskListId: string, title: string): Promise<TaskListSummary> {
  const api = getTasksApi();
  const res = await api.tasklists.patch({ tasklist: taskListId, requestBody: { title } });
  return toTaskListSummary(res.data);
}

export async function deleteTaskList(taskListId: string): Promise<void> {
  const api = getTasksApi();
  await api.tasklists.delete({ tasklist: taskListId });
}

// ---- Tasks ------------------------------------------------------------------

export interface ListTasksParams {
  taskListId: string;
  maxResults: number;
  pageToken?: string;
  showCompleted?: boolean;
  showDeleted?: boolean;
  showHidden?: boolean;
  completedMin?: string;
  completedMax?: string;
  dueMin?: string;
  dueMax?: string;
  updatedMin?: string;
}

export async function listTasks(
  params: ListTasksParams
): Promise<{ items: TaskSummary[]; nextPageToken?: string }> {
  const api = getTasksApi();
  const res = await api.tasks.list({
    tasklist: params.taskListId,
    maxResults: params.maxResults,
    pageToken: params.pageToken,
    showCompleted: params.showCompleted,
    showDeleted: params.showDeleted,
    showHidden: params.showHidden,
    completedMin: params.completedMin,
    completedMax: params.completedMax,
    dueMin: params.dueMin,
    dueMax: params.dueMax,
    updatedMin: params.updatedMin,
  });
  return {
    items: (res.data.items ?? []).map(toTaskSummary),
    ...(res.data.nextPageToken ? { nextPageToken: res.data.nextPageToken } : {}),
  };
}

export async function getTask(taskListId: string, taskId: string): Promise<TaskSummary> {
  const api = getTasksApi();
  const res = await api.tasks.get({ tasklist: taskListId, task: taskId });
  return toTaskSummary(res.data);
}

export interface CreateTaskParams {
  taskListId: string;
  title: string;
  notes?: string;
  due?: string;
  parent?: string;
  previous?: string;
}

export async function createTask(params: CreateTaskParams): Promise<TaskSummary> {
  const api = getTasksApi();
  const res = await api.tasks.insert({
    tasklist: params.taskListId,
    parent: params.parent,
    previous: params.previous,
    requestBody: {
      title: params.title,
      notes: params.notes,
      due: params.due,
    },
  });
  return toTaskSummary(res.data);
}

export interface UpdateTaskParams {
  taskListId: string;
  taskId: string;
  title?: string;
  notes?: string;
  due?: string | null;
  status?: "needsAction" | "completed";
}

export async function updateTask(params: UpdateTaskParams): Promise<TaskSummary> {
  const api = getTasksApi();
  const res = await api.tasks.patch({
    tasklist: params.taskListId,
    task: params.taskId,
    requestBody: {
      ...(params.title !== undefined ? { title: params.title } : {}),
      ...(params.notes !== undefined ? { notes: params.notes } : {}),
      ...(params.due !== undefined ? { due: params.due } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
    },
  });
  return toTaskSummary(res.data);
}

export async function deleteTask(taskListId: string, taskId: string): Promise<void> {
  const api = getTasksApi();
  await api.tasks.delete({ tasklist: taskListId, task: taskId });
}

export async function moveTask(params: {
  taskListId: string;
  taskId: string;
  parent?: string;
  previous?: string;
  destinationTaskList?: string;
}): Promise<TaskSummary> {
  const api = getTasksApi();
  const res = await api.tasks.move({
    tasklist: params.taskListId,
    task: params.taskId,
    parent: params.parent,
    previous: params.previous,
    destinationTasklist: params.destinationTaskList,
  });
  return toTaskSummary(res.data);
}

export async function clearCompletedTasks(taskListId: string): Promise<void> {
  const api = getTasksApi();
  await api.tasks.clear({ tasklist: taskListId });
}
