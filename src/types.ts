/** Minimal shape of the installed-app OAuth client secret JSON downloaded from
 * Google Cloud Console (Credentials -> OAuth client ID -> Desktop app). */
export interface ClientSecretFile {
  installed?: ClientSecretInner;
  web?: ClientSecretInner;
}

export interface ClientSecretInner {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
}

/** Cached OAuth token shape written by `npm run auth` and refreshed automatically
 * by google-auth-library on subsequent runs. */
export interface StoredToken {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
}

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

/** Normalized task list shape returned by our tools (trims the raw API payload). */
export interface TaskListSummary {
  id: string;
  title: string;
  updated?: string;
}

/** Normalized task shape returned by our tools. */
export interface TaskSummary {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  notes?: string;
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
  deleted?: boolean;
  hidden?: boolean;
  updated?: string;
  webViewLink?: string;
}
