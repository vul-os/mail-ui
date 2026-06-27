import { useState } from 'react'
import Icon from './Icon.jsx'
import Logo from './Logo.jsx'

export const STARRED_FOLDER = '__starred'

/** Order in which special folders appear (Gmail-like). */
const SPECIAL_ORDER = ['inbox', 'starred', 'sent', 'drafts', 'archive', 'junk', 'trash']

/** Which specials sit in the always-visible primary group vs the "More" group. */
const PRIMARY = new Set(['inbox', 'starred', 'sent', 'drafts'])

/** Classify a mailbox into a special kind (or 'label') by special-use + name. */
export function classifyFolder(f) {
  const attrs = (f.attributes || f.Attributes || []).map((a) => String(a).toLowerCase())
  const name = String(f.name ?? f.path ?? '').toLowerCase()
  const has = (s) => attrs.includes('\\' + s) || name === s || name.endsWith('/' + s)
  if (name === 'inbox' || attrs.includes('\\inbox')) return 'inbox'
  if (has('sent') || name.includes('sent')) return 'sent'
  if (has('drafts') || name.includes('draft')) return 'drafts'
  if (has('trash') || name.includes('trash') || name.includes('deleted') || name === 'bin') return 'trash'
  if (has('archive') || name.includes('archive')) return 'archive'
  if (has('junk') || name.includes('junk') || name.includes('spam')) return 'junk'
  return 'label'
}

/**
 * Classify a label-kind folder as a Gmail-style category, or null. Categories
 * map gracefully onto IMAP folders named Social / Promotions / Updates / Forums;
 * absent those folders the Categories section simply doesn't render.
 */
export function classifyCategory(f) {
  const name = String(f.name ?? f.path ?? '').toLowerCase()
  const base = name.split('/').pop()
  if (base === 'social') return 'social'
  if (base === 'promotions' || base === 'promos' || base === 'promo') return 'promotions'
  if (base === 'updates' || base === 'forums' || base === 'notifications') return base === 'forums' ? 'forums' : 'updates'
  return null
}

const ICON_FOR = {
  inbox: 'inbox', starred: 'star', sent: 'send', drafts: 'draft',
  archive: 'archive', trash: 'trash', junk: 'shield', label: 'tag',
}
const LABEL_FOR = {
  inbox: 'Inbox', starred: 'Starred', sent: 'Sent', drafts: 'Drafts',
  archive: 'Archive', trash: 'Trash', junk: 'Spam',
}
const CATEGORY_META = {
  social: { icon: 'users', label: 'Social' },
  promotions: { icon: 'tag', label: 'Promotions' },
  updates: { icon: 'info', label: 'Updates' },
  forums: { icon: 'users', label: 'Forums' },
}

/** Stable hue 0..359 from a label path, for its colour dot (theme-safe HSL). */
function labelHue(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}
function fmtBytes(n) {
  if (!n && n !== 0) return ''
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return (v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)) + ' ' + u[i]
}

/**
 * <FolderList/> — comprehensive Gmail-class left rail.
 *
 * Prominent Compose, a primary mailbox group (Inbox / Starred / Sent / Drafts)
 * with icons + unread counts, a collapsible "More" group for the less-used
 * mailboxes (Archive / Spam / Trash), then capability-gated Categories and
 * user Labels (coloured dots, nesting) and an optional storage meter. Anything
 * the backend doesn't expose is hidden rather than shown as a dead control.
 * Collapses to an icon-only rail.
 */
export default function FolderList({
  folders = [], current, onSelect, onCompose, me,
  collapsed = false, onToggleCollapse, starredCount = 0,
  onOpenPanel, onOpenHelp, onManageLabels, quota = null,
}) {
  const [moreOpen, setMoreOpen] = useState(false)

  // Bucket real folders by kind; first match wins per special kind.
  const specials = {}
  const categories = []
  const labels = []
  for (const f of folders) {
    const path = f.path ?? f.name ?? f.id
    const kind = classifyFolder(f)
    const unread = f.unread ?? f.unseen ?? f.UnreadCount ?? 0
    if (kind === 'label') {
      const cat = classifyCategory(f)
      if (cat) categories.push({ path, kind: 'category', cat, label: CATEGORY_META[cat]?.label ?? path, unread })
      else labels.push({ path, kind: 'label', label: f.name ?? path, unread, depth: String(path).split('/').length - 1 })
    } else if (!specials[kind]) {
      specials[kind] = { path, kind, label: LABEL_FOR[kind] ?? (f.name ?? path), unread }
    }
  }
  // Inject the virtual Starred view.
  specials.starred = { path: STARRED_FOLDER, kind: 'starred', label: 'Starred', unread: 0 }

  const ordered = SPECIAL_ORDER.map((k) => specials[k]).filter(Boolean)
  const primary = ordered.filter((it) => PRIMARY.has(it.kind))
  const more = ordered.filter((it) => !PRIMARY.has(it.kind))

  const renderItem = (it, extra) => {
    const active = it.path === current
    return (
      <li key={it.path}>
        <button
          type="button"
          className={'vm-folder' + (active ? ' vm-active' : '') + (extra?.indent ? ' vm-folder-nested' : '')}
          aria-current={active ? 'true' : undefined}
          onClick={() => onSelect?.(it.path)}
          title={it.label}
          style={extra?.indent ? { paddingLeft: 12 + extra.indent * 16 + 'px' } : undefined}
        >
          {extra?.dot != null ? (
            <span className="vm-label-dot" style={{ background: `hsl(${extra.dot} 55% 55%)` }} aria-hidden="true" />
          ) : (
            <Icon name={extra?.icon || ICON_FOR[it.kind] || 'tag'} className="vm-icon" />
          )}
          <span className="vm-folder-name">{it.label}</span>
          {it.unread > 0 && <span className="vm-folder-count">{it.unread}</span>}
        </button>
      </li>
    )
  }

  const usedPct = quota?.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0

  return (
    <nav className={'vm-sidebar' + (collapsed ? ' vm-collapsed' : '')} aria-label="Mailboxes">
      <div className="vm-brand">
        <button
          type="button"
          className="vm-iconbtn vm-rail-toggle"
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          onClick={onToggleCollapse}
        >
          <Icon name="menu" />
        </button>
        <Logo wordmark={!collapsed} className="vm-brand-logo" />
      </div>

      <button type="button" className="vm-compose-btn" onClick={onCompose} title="Compose">
        <Icon name="pencil" />
        <span className="vm-compose-label">Compose</span>
      </button>

      <div className="vm-folders-scroll">
        <ul className="vm-folders">
          {primary.map((it) => renderItem(it))}

          {more.length > 0 && (
            <>
              <li>
                <button
                  type="button"
                  className="vm-folder vm-more-toggle"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                  title={moreOpen ? 'Less' : 'More'}
                >
                  <Icon name={moreOpen ? 'chevdown' : 'chevright'} className="vm-icon" />
                  <span className="vm-folder-name">{moreOpen ? 'Less' : 'More'}</span>
                </button>
              </li>
              {moreOpen && more.map((it) => renderItem(it))}
            </>
          )}
        </ul>

        {categories.length > 0 && (
          <ul className="vm-folders">
            <li className="vm-folder-section" aria-hidden="true"><span>Categories</span></li>
            {categories.map((it) => renderItem(it, { icon: CATEGORY_META[it.cat]?.icon }))}
          </ul>
        )}

        {labels.length > 0 && (
          <ul className="vm-folders">
            <li className="vm-folder-section">
              <span>Labels</span>
              {onManageLabels && (
                <button type="button" className="vm-section-action" aria-label="Manage labels"
                  title="Manage labels" onClick={onManageLabels}><Icon name="pluscircle" /></button>
              )}
            </li>
            {labels.map((it) => renderItem(it, { dot: labelHue(it.path), indent: it.depth }))}
          </ul>
        )}
      </div>

      {/* Mobile-only: Calendar / Contacts / Settings / Shortcuts otherwise live
          in the far-right rail, which is hidden ≤768px. */}
      {(onOpenPanel || onOpenHelp) && (
        <ul className="vm-folders vm-drawer-extra" aria-label="Tools">
          <li className="vm-folder-section" aria-hidden="true"><span>More</span></li>
          {onOpenPanel && (
            <>
              <li>
                <button type="button" className="vm-folder" onClick={() => onOpenPanel('calendar')} title="Calendar">
                  <Icon name="calendar" className="vm-icon" /><span className="vm-folder-name">Calendar</span>
                </button>
              </li>
              <li>
                <button type="button" className="vm-folder" onClick={() => onOpenPanel('contacts')} title="Contacts">
                  <Icon name="users" className="vm-icon" /><span className="vm-folder-name">Contacts</span>
                </button>
              </li>
              <li>
                <button type="button" className="vm-folder" onClick={() => onOpenPanel('settings')} title="Settings">
                  <Icon name="settings" className="vm-icon" /><span className="vm-folder-name">Settings</span>
                </button>
              </li>
            </>
          )}
          {onOpenHelp && (
            <li>
              <button type="button" className="vm-folder" onClick={onOpenHelp} title="Keyboard shortcuts">
                <Icon name="keyboard" className="vm-icon" /><span className="vm-folder-name">Shortcuts</span>
              </button>
            </li>
          )}
        </ul>
      )}

      {quota?.limit > 0 && (
        <div className="vm-quota" title={`${fmtBytes(quota.used)} of ${fmtBytes(quota.limit)} used`}>
          <div className="vm-quota-head">
            <Icon name="database" className="vm-icon" />
            <span className="vm-quota-text">{fmtBytes(quota.used)} of {fmtBytes(quota.limit)}</span>
          </div>
          <div className="vm-quota-bar" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
            <span className={'vm-quota-fill' + (usedPct >= 90 ? ' vm-quota-full' : '')} style={{ width: usedPct + '%' }} />
          </div>
        </div>
      )}

      {me?.email && (
        <div className="vm-sidebar-foot" title={me.email}>
          <span className="vm-me-avatar" aria-hidden="true">{(me.email[0] || '?').toUpperCase()}</span>
          <span className="vm-me">{me.email}</span>
        </div>
      )}
    </nav>
  )
}
