import { CHARACTER_LIMIT } from "./constants.js";
import { ResponseFormat, type TaskListSummary, type TaskSummary } from "./types.js";

/** Truncates a JSON-serializable payload's array field if the rendered text would
 * exceed CHARACTER_LIMIT, and notes the truncation so the agent knows to page further. */
export function truncateItems<T>(
  items: T[],
  buildText: (items: T[]) => string
): { text: string; truncated: boolean; returnedCount: number } {
  let text = buildText(items);
  if (text.length <= CHARACTER_LIMIT || items.length <= 1) {
    return { text, truncated: false, returnedCount: items.length };
  }
  let slice = items;
  while (text.length > CHARACTER_LIMIT && slice.length > 1) {
    slice = slice.slice(0, Math.max(1, Math.floor(slice.length / 2)));
    text = buildText(slice);
  }
  return { text, truncated: true, returnedCount: slice.length };
}

export function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function taskListsToMarkdown(lists: TaskListSummary[]): string {
  if (!lists.length) return "No task lists found.";
  const lines = ["# Google Task Lists", ""];
  for (const l of lists) {
    lines.push(`- **${l.title}** (id: \`${l.id}\`)`);
  }
  return lines.join("\n");
}

export function taskListToMarkdown(list: TaskListSummary): string {
  return `# ${list.title}\n\n- id: \`${list.id}\`${list.updated ? `\n- updated: ${formatDate(list.updated)}` : ""}`;
}

export function tasksToMarkdown(tasks: TaskSummary[], listTitle?: string): string {
  const header = listTitle ? `# Tasks in "${listTitle}"` : "# Tasks";
  if (!tasks.length) return `${header}\n\nNo tasks found.`;
  const lines = [header, ""];
  for (const t of tasks) {
    const box = t.status === "completed" ? "[x]" : "[ ]";
    const due = t.due ? ` (due ${formatDate(t.due)})` : "";
    const parent = t.parent ? " ↳subtask" : "";
    lines.push(`- ${box} **${t.title}**${due}${parent} — id: \`${t.id}\``);
    if (t.notes) lines.push(`  - notes: ${t.notes}`);
  }
  return lines.join("\n");
}

export function taskToMarkdown(t: TaskSummary): string {
  const lines = [
    `# ${t.title}`,
    "",
    `- id: \`${t.id}\``,
    `- status: ${t.status}`,
  ];
  if (t.due) lines.push(`- due: ${formatDate(t.due)}`);
  if (t.completed) lines.push(`- completed: ${formatDate(t.completed)}`);
  if (t.parent) lines.push(`- parent task id: \`${t.parent}\``);
  if (t.notes) lines.push(`- notes: ${t.notes}`);
  if (t.webViewLink) lines.push(`- link: ${t.webViewLink}`);
  return lines.join("\n");
}

export function renderResult<T extends object>(
  format: ResponseFormat,
  json: T,
  markdown: string
): { content: Array<{ type: "text"; text: string }>; structuredContent: Record<string, unknown> } {
  const text = format === ResponseFormat.JSON ? JSON.stringify(json, null, 2) : markdown;
  return {
    content: [{ type: "text", text }],
    structuredContent: json as Record<string, unknown>,
  };
}
