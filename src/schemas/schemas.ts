import { z } from "zod";
import { DEFAULT_PAGE_SIZE, DEFAULT_TASKLIST_ID, MAX_PAGE_SIZE } from "../constants.js";
import { ResponseFormat } from "../types.js";

export const responseFormatField = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable text or 'json' for machine-readable structured data.");

// A factory, not a shared instance. zod-to-json-schema deduplicates repeated
// schema *instances* into `$ref`s pointing at the first occurrence, which drops
// each field's own .describe() text — `due_max` ended up documented with
// `due_min`'s description, i.e. exactly inverted. A fresh instance per field
// keeps the descriptions intact and keeps the emitted schema $ref-free, which
// strict function-calling validators (OpenAI/Codex) also require.
const rfc3339DateTime = () =>
  z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Must be a valid RFC 3339 / ISO 8601 timestamp")
    .describe("RFC 3339 timestamp, e.g. '2026-09-10T00:00:00Z'");

export const taskListIdField = z
  .string()
  .min(1)
  .default(DEFAULT_TASKLIST_ID)
  .describe(
    "ID of the task list, or '@default' for the user's default list. Get IDs from google_tasks_list_tasklists."
  );

// ---- Task list schemas ------------------------------------------------------

export const ListTaskListsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
      .describe("Maximum number of task lists to return (1-100)."),
    page_token: z.string().optional().describe("Pagination token from a previous response's next_page_token."),
    response_format: responseFormatField,
  })
  .strict();
export type ListTaskListsInput = z.infer<typeof ListTaskListsInputSchema>;

export const GetTaskListInputSchema = z
  .object({
    tasklist_id: z.string().min(1).describe("ID of the task list to fetch."),
    response_format: responseFormatField,
  })
  .strict();
export type GetTaskListInput = z.infer<typeof GetTaskListInputSchema>;

export const CreateTaskListInputSchema = z
  .object({
    title: z.string().min(1).max(1024).describe("Title for the new task list."),
    response_format: responseFormatField,
  })
  .strict();
export type CreateTaskListInput = z.infer<typeof CreateTaskListInputSchema>;

export const UpdateTaskListInputSchema = z
  .object({
    tasklist_id: z.string().min(1).describe("ID of the task list to rename."),
    title: z.string().min(1).max(1024).describe("New title for the task list."),
    response_format: responseFormatField,
  })
  .strict();
export type UpdateTaskListInput = z.infer<typeof UpdateTaskListInputSchema>;

export const DeleteTaskListInputSchema = z
  .object({
    tasklist_id: z
      .string()
      .min(1)
      .describe("ID of the task list to permanently delete. Cannot be '@default'."),
  })
  .strict();
export type DeleteTaskListInput = z.infer<typeof DeleteTaskListInputSchema>;

// ---- Task schemas ------------------------------------------------------------

export const ListTasksInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
      .describe("Maximum number of tasks to return (1-100)."),
    page_token: z.string().optional().describe("Pagination token from a previous response's next_page_token."),
    show_completed: z.boolean().default(true).describe("Whether to include completed tasks."),
    show_deleted: z.boolean().default(false).describe("Whether to include deleted tasks."),
    show_hidden: z.boolean().default(false).describe("Whether to include hidden (completed + cleared) tasks."),
    due_min: rfc3339DateTime().optional().describe("Only return tasks due on or after this time."),
    due_max: rfc3339DateTime().optional().describe("Only return tasks due before this time."),
    updated_min: rfc3339DateTime().optional().describe("Only return tasks last modified on or after this time."),
    response_format: responseFormatField,
  })
  .strict();
export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

export const GetTaskInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    task_id: z.string().min(1).describe("ID of the task to fetch."),
    response_format: responseFormatField,
  })
  .strict();
export type GetTaskInput = z.infer<typeof GetTaskInputSchema>;

export const CreateTaskInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    title: z.string().min(1).max(1024).describe("Title of the new task."),
    notes: z.string().max(8192).optional().describe("Free-text notes/description for the task."),
    due: rfc3339DateTime().optional().describe(
      "Due date/time as RFC 3339, e.g. '2026-09-10T00:00:00Z'. Google Tasks only stores the date portion."
    ),
    parent_task_id: z
      .string()
      .optional()
      .describe("ID of a parent task, to create this as a subtask. Omit for a top-level task."),
    previous_task_id: z
      .string()
      .optional()
      .describe("ID of the task this one should be placed after in the list ordering. Omit to add at the top."),
    response_format: responseFormatField,
  })
  .strict();
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    task_id: z.string().min(1).describe("ID of the task to update."),
    title: z.string().min(1).max(1024).optional().describe("New title for the task."),
    notes: z.string().max(8192).optional().describe("New notes/description. Pass an empty string to clear it."),
    due: z
      .union([rfc3339DateTime(), z.null()])
      .optional()
      .describe("New due date as RFC 3339, or null to clear the due date."),
    status: z
      .enum(["needsAction", "completed"])
      .optional()
      .describe("New status. Prefer google_tasks_complete_task / google_tasks_reopen_task for status changes."),
    response_format: responseFormatField,
  })
  .strict();
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const CompleteTaskInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    task_id: z.string().min(1).describe("ID of the task to mark completed."),
    response_format: responseFormatField,
  })
  .strict();
export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>;

export const ReopenTaskInputSchema = CompleteTaskInputSchema;
export type ReopenTaskInput = z.infer<typeof ReopenTaskInputSchema>;

export const DeleteTaskInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    task_id: z.string().min(1).describe("ID of the task to permanently delete."),
  })
  .strict();
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

export const MoveTaskInputSchema = z
  .object({
    tasklist_id: taskListIdField,
    task_id: z.string().min(1).describe("ID of the task to move/reorder."),
    parent_task_id: z
      .string()
      .optional()
      .describe("ID of the new parent task, to nest this as a subtask. Omit to keep/make it top-level."),
    previous_task_id: z
      .string()
      .optional()
      .describe("ID of the task this one should be placed after. Omit to move it to the top."),
    destination_tasklist_id: z
      .string()
      .optional()
      .describe("ID of a different task list to move this task into. Omit to reorder within the same list."),
    response_format: responseFormatField,
  })
  .strict();
export type MoveTaskInput = z.infer<typeof MoveTaskInputSchema>;

export const ClearCompletedTasksInputSchema = z
  .object({
    tasklist_id: taskListIdField,
  })
  .strict();
export type ClearCompletedTasksInput = z.infer<typeof ClearCompletedTasksInputSchema>;
