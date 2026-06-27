/**
 * Type declarations for `@vulos/mail-ui` (src/lib/index.js).
 *
 * Hand-authored: the library ships as JS/JSX, so these declarations live next to
 * the source and are copied into dist-lib/ by the lib build (see
 * vite.config.lib.js). Keep in sync with src/lib/index.js and the components it
 * re-exports.
 */

import * as React from 'react'
import type {
  MailClient,
  MailClientOptions,
  MessageDraft,
  CalendarEventInput,
  DateRange,
} from './api.js'

export type {
  MailClient,
  MailClientOptions,
  MessageDraft,
  CalendarEventInput,
  DateRange,
}
export { createMailClient, ApiError, FLAG_SEEN, FLAG_FLAGGED } from './api.js'

// ── Shared shapes ───────────────────────────────────────────────────────────

/** A folder/mailbox descriptor as returned by the lilmail /v1 API. */
export interface MailboxInfo {
  name: string
  [key: string]: unknown
}

/** A flat message as returned by the lilmail /v1 API. */
export interface Email {
  id: string | number
  messageId?: string
  inReplyTo?: string
  references?: string[]
  from?: string
  fromName?: string
  subject?: string
  preview?: string
  date?: string
  flags?: string[]
  hasAttachments?: boolean
  [key: string]: unknown
}

/** A grouped conversation produced by `groupThreads`. */
export interface Thread {
  id: string | number
  ids: Array<string | number>
  messages: Email[]
  count: number
  root: Email
  latest: Email
  from?: string
  fromName?: string
  subject?: string
  preview?: string
  date?: string
  ts: number
  participants: Array<{ name: string; email?: string }>
  hasAttachments: boolean
  unread: boolean
  starred: boolean
}

// ── Components ───────────────────────────────────────────────────────────────

/** Props shared by the top-level surfaces that own (or accept) an API client. */
interface ClientSurfaceProps {
  /** Base URL for an internally-created client (ignored when `client` is given). */
  baseUrl?: string
  /** Pre-built client (overrides `baseUrl`). */
  client?: MailClient
  /** Called when the API surfaces a 401. */
  onAuthError?: () => void
}

export interface MailAppProps extends ClientSurfaceProps {
  onSend?: (draft: MessageDraft) => void
  settingsExtra?: React.ReactNode
}
export const MailApp: React.FC<MailAppProps>

export interface CalendarProps extends ClientSurfaceProps {
  defaultView?: 'month' | 'week' | 'day' | 'agenda'
}
export const Calendar: React.FC<CalendarProps>

export interface CalendarPanelProps {
  client?: MailClient
  onAuthError?: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onHide?: () => void
}
export const CalendarPanel: React.FC<CalendarPanelProps>

export interface ContactsProps extends ClientSurfaceProps {
  onSelect?: (contact: { email: string; name?: string }) => void
}
export const Contacts: React.FC<ContactsProps>

export interface LogoProps {
  wordmark?: boolean
  className?: string
}
export const Logo: React.FC<LogoProps>

export interface FolderListProps {
  folders?: MailboxInfo[]
  current?: string
  onSelect?: (folder: string) => void
  onCompose?: () => void
  me?: { email?: string; username?: string }
  collapsed?: boolean
  onToggleCollapse?: () => void
  starredCount?: number
  onOpenPanel?: () => void
  onOpenHelp?: () => void
  onManageLabels?: () => void
  quota?: { used: number; limit: number } | null
}
export const FolderList: React.FC<FolderListProps>

export interface MessageListProps {
  threads?: Thread[]
  selectedId?: string | number
  focusId?: string | number
  selection?: Set<string | number>
  onToggleSelect?: (id: string | number) => void
  onSelectRange?: (id: string | number) => void
  onSelectAll?: () => void
  onOpen?: (thread: Thread) => void
  onToggleStar?: (thread: Thread) => void
  onArchive?: (thread: Thread) => void
  onDelete?: (thread: Thread) => void
  onToggleRead?: (thread: Thread) => void
  onRefresh?: () => void
  onCompose?: () => void
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  query?: string
  onSearch?: (q: string) => void
  onClearSearch?: () => void
  canArchive?: boolean
  folder?: string
  searchRef?: React.Ref<HTMLInputElement>
  onMenu?: () => void
}
export const MessageList: React.FC<MessageListProps>

export interface MessageViewProps {
  thread?: Thread
  fullById?: Record<string | number, Email>
  onNeedBody?: (id: string | number) => void
  loading?: boolean
  error?: unknown
  onToggleStar?: (thread: Thread) => void
  onArchive?: (thread: Thread) => void
  onDelete?: (thread: Thread) => void
  onReply?: (message: Email) => void
  onReplyAll?: (message: Email) => void
  onForward?: (message: Email) => void
  onBack?: () => void
  onDownloadAttachment?: (uid: string | number, partId: string | number, filename?: string) => void
  canArchive?: boolean
  attachmentsSupported?: boolean
}
export const MessageView: React.FC<MessageViewProps>

export interface ComposeProps {
  initial?: Partial<MessageDraft>
  onSend?: (draft: MessageDraft) => void
  onClose?: () => void
  onSaveDraft?: (draft: MessageDraft) => void
  onContactSearch?: (q: string) => Promise<Array<{ email: string; name?: string }>>
  signature?: string
}
export const Compose: React.FC<ComposeProps>

export interface SettingsProps {
  settings: MailSettings
  onChange?: (patch: Partial<MailSettings> | ((s: MailSettings) => Partial<MailSettings>)) => void
  onClose?: () => void
  extra?: React.ReactNode
  labels?: string[]
  quota?: { used: number; limit: number } | null
  onShowShortcuts?: () => void
}
export const Settings: React.FC<SettingsProps>

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string
}
export const Icon: React.FC<IconProps>

// ── Threading ────────────────────────────────────────────────────────────────

export interface GroupThreadsOptions {
  /** When false, every message is its own thread. Default true. */
  threaded?: boolean
}
export function groupThreads(messages?: Email[], opts?: GroupThreadsOptions): Thread[]

// ── Settings hook ────────────────────────────────────────────────────────────

export interface MailSettings {
  density: 'comfortable' | 'compact'
  readingPane: 'right' | 'bottom' | 'off'
  theme: 'system' | 'dark' | 'light'
  inboxType: 'default' | 'unread' | 'starred'
  preview: boolean
  shortcuts: boolean
  threaded: boolean
  notifications: boolean
  calendarPanel: boolean
  calendarExpanded: boolean
  signature: string
}

export const DEFAULT_SETTINGS: MailSettings

export type SettingsUpdater = (
  patch: Partial<MailSettings> | ((s: MailSettings) => Partial<MailSettings>),
) => void

export function useSettings(): [MailSettings, SettingsUpdater]

// ── Sanitisation ─────────────────────────────────────────────────────────────

export interface SanitizeOptions {
  /** Allow remote-loading content (images/media). Default false. */
  allowRemote?: boolean
}

export function sanitizeEmailBody(
  html: string,
  opts?: SanitizeOptions,
): { html: string; hasRemote: boolean }

export function sanitizeEmailHtml(html: string, opts?: SanitizeOptions): string

export function stripHtml(html: string): string
