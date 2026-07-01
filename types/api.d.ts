/**
 * Type declarations for `@vulos/mail-ui/api` (src/api.js).
 *
 * Hand-authored: the library ships as JS/JSX, so these declarations are
 * maintained alongside the source and copied into dist-lib/ by the lib build
 * (see vite.config.lib.js). Keep in sync with src/api.js.
 */

/** IMAP `\Seen` system flag. */
export const FLAG_SEEN: '\\Seen'
/** IMAP `\Flagged` system flag. */
export const FLAG_FLAGGED: '\\Flagged'

/** Error thrown for any non-2xx response, carrying the HTTP status. */
export class ApiError extends Error {
  constructor(message: string, status: number)
  name: 'ApiError'
  status: number
}

export interface MailClientOptions {
  /** Origin + prefix, e.g. '/v1' or 'https://mail.example.com/v1'. Default '/v1'. */
  baseUrl?: string
  /** fetch implementation override (tests / SSR). */
  fetch?: typeof fetch
}

export interface FolderQuery {
  folder?: string
}

export interface ListMessagesOptions extends FolderQuery {
  limit?: number
}

export interface SearchOptions extends FolderQuery {
  limit?: number
}

/** Paged list/search options (offset or opaque cursor). */
export interface PageQuery extends FolderQuery {
  limit?: number
  offset?: number
  cursor?: string
}

/** Normalised page returned by listMessagesPage / searchPage. */
export interface MessagePage {
  messages: any[]
  total?: number
  nextCursor: string | null
  nextOffset: number | null
  hasMore: boolean
}

/** Staged-attachment descriptor returned by uploadAttachment. */
export interface UploadedAttachment {
  id: string | number | undefined
  filename?: string
  size?: number
  contentType?: string
}

export interface DeleteMessageOptions extends FolderQuery {
  /** Expunge instead of moving to Trash. */
  hard?: boolean
}

/** Draft payload for sendMessage / saveDraft. */
export interface MessageDraft {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  text?: string
  html?: string
  inReplyTo?: string
  [key: string]: unknown
}

export interface DateRange {
  start?: Date | string
  end?: Date | string
}

/** Calendar event payload for createEvent. */
export interface CalendarEventInput extends DateRange {
  [key: string]: unknown
}

export interface ContactsQuery {
  q?: string
  limit?: number
}

/** Mail API client bound to a base URL. See src/api.js for the wire contract. */
export interface MailClient {
  readonly baseUrl: string
  buildUrl(path: string, query?: Record<string, unknown>): string

  me(): Promise<any>
  listFolders(): Promise<any[]>
  listMessages(opts?: ListMessagesOptions): Promise<any[]>
  /** Paged sibling of listMessages — powers infinite scroll. Optional /v1. */
  listMessagesPage(opts?: PageQuery): Promise<MessagePage>
  getMessage(uid: string | number, opts?: FolderQuery): Promise<any>
  search(q: string, opts?: SearchOptions): Promise<any[]>
  /** Paged sibling of search. Optional /v1. */
  searchPage(q: string, opts?: PageQuery): Promise<MessagePage>
  setFlag(uid: string | number, flag: string, add: boolean, opts?: FolderQuery): Promise<null>
  /** Hide until `until`, then re-deliver. Optional /v1 (404/405 → ApiError). */
  snooze(uid: string | number, until: Date | string, opts?: FolderQuery): Promise<null>
  /** Add/remove a user label/keyword. Optional /v1 (404/405 → ApiError). */
  applyLabel(uid: string | number, label: string, add: boolean, opts?: FolderQuery): Promise<null>
  deleteMessage(uid: string | number, opts?: DeleteMessageOptions): Promise<null>
  moveMessage(uid: string | number, toFolder: string, opts?: FolderQuery): Promise<null>
  sendMessage(draft: MessageDraft): Promise<any>
  saveDraft(draft: MessageDraft): Promise<any>

  listEvents(opts?: DateRange): Promise<any[]>
  createEvent(event: CalendarEventInput): Promise<any>
  deleteEvent(uid: string | number): Promise<null>
  freeBusy(opts?: DateRange): Promise<Array<{ start: string; end: string }>>

  listContacts(opts?: ContactsQuery): Promise<Array<{ email: string; name?: string }>>

  quota(): Promise<{ used: number; limit: number }>
  downloadAttachment(uid: string | number, partId: string | number, filename?: string): Promise<Blob>
  /** Stage an outgoing attachment (multipart). Optional /v1 (404/405 → ApiError). */
  uploadAttachment(file: Blob, opts?: { fieldName?: string; signal?: AbortSignal }): Promise<UploadedAttachment>
}

/** Create a mail API client bound to a base URL. */
export function createMailClient(opts?: MailClientOptions): MailClient

export default createMailClient
