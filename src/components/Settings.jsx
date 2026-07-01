import Icon from './Icon.jsx'

/** A segmented control. */
function Seg({ value, onChange, options, ariaLabel }) {
  return (
    <div className="vm-segctl" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={'vm-seg' + (value === o.value ? ' vm-on' : '')} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} />} {o.label}
        </button>
      ))}
    </div>
  )
}

/** A labelled settings section. */
function Section({ title, icon, children }) {
  return (
    <section className="vm-set-section">
      <h3 className="vm-set-section-title">{icon && <Icon name={icon} className="vm-set-section-icon" />}{title}</h3>
      <div className="vm-set-group">{children}</div>
    </section>
  )
}

function fmtBytes(n) {
  if (!n && n !== 0) return ''
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return (v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)) + ' ' + u[i]
}
function labelHue(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

/**
 * <Settings/> — comprehensive, sectioned preferences panel.
 *
 * Appearance, inbox layout, reading, notifications, labels, storage, signature
 * and keyboard shortcuts. Every control is a genuinely-applied client preference
 * (persisted via useSettings) or reflects real server data — there are no
 * dishonest fields. Server-backed surfaces the /v1 contract doesn't expose
 * (identities, filters, vacation auto-reply) are intentionally omitted rather
 * than shown as dead UI; a host can inject its own via `extra`. Capability-gated
 * sections (Labels, Storage) appear only when the backend provides the data.
 *
 * @param {object} props
 * @param {object} props.settings
 * @param {(patch)=>void} props.onChange
 * @param {()=>void} [props.onClose]
 * @param {import('react').ReactNode} [props.extra] - host-supplied section(s),
 *   rendered first (above the built-in preferences).
 * @param {Array<{path,label}>} [props.labels] - user labels (read-only overview).
 * @param {{used,limit}|null} [props.quota] - mailbox storage (bytes), if known.
 * @param {()=>void} [props.onShowShortcuts]
 */
export default function Settings({ settings, onChange, onClose, extra, labels = [], quota = null, onShowShortcuts }) {
  const set = (patch) => onChange?.(patch)

  const toggleNotifications = (v) => {
    if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission() } catch { /* ignore */ }
    }
    set({ notifications: v })
  }
  const notifDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const usedPct = quota?.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0

  return (
    <div className="vm-settings">
      <header className="vm-panel-head">
        <h2><Icon name="settings" className="vm-icon" /> Settings</h2>
        <button type="button" className="vm-iconbtn" aria-label="Close settings" onClick={onClose}><Icon name="close" /></button>
      </header>

      <div className="vm-panel-body">
        {extra}

        <Section title="General" icon="inbox">
          <div className="vm-set-row">
            <label className="vm-set-label">Inbox type</label>
            <Seg value={settings.inboxType ?? 'default'} onChange={(v) => set({ inboxType: v })} ariaLabel="Inbox type"
              options={[
                { value: 'default', label: 'Default' },
                { value: 'unread', label: 'Unread first' },
                { value: 'starred', label: 'Starred first' },
              ]} />
            <p className="vm-set-desc">Orders the conversation list. Applied instantly, client-side.</p>
          </div>

          <div className="vm-set-row">
            <label className="vm-set-label">Reading pane</label>
            <Seg value={settings.readingPane} onChange={(v) => set({ readingPane: v })} ariaLabel="Reading pane"
              options={[{ value: 'right', label: 'Right' }, { value: 'bottom', label: 'Bottom' }, { value: 'off', label: 'No split' }]} />
            <p className="vm-set-desc">Where an opened conversation appears next to the message list.</p>
          </div>

          <div className="vm-set-row">
            <label className="vm-set-label">Density</label>
            <Seg value={settings.density} onChange={(v) => set({ density: v })} ariaLabel="Density"
              options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
          </div>

          <div className="vm-set-row vm-set-inline">
            <span className="vm-set-line">
              <label className="vm-set-label" htmlFor="vm-set-threaded">Conversation view</label>
              <span className="vm-set-desc">Group replies into a single thread.</span>
            </span>
            <Toggle id="vm-set-threaded" checked={settings.threaded} onChange={(v) => set({ threaded: v })} />
          </div>

          <div className="vm-set-row vm-set-inline">
            <span className="vm-set-line">
              <label className="vm-set-label" htmlFor="vm-set-preview">Preview text</label>
              <span className="vm-set-desc">Show the message snippet under each subject.</span>
            </span>
            <Toggle id="vm-set-preview" checked={settings.preview !== false} onChange={(v) => set({ preview: v })} />
          </div>

          <div className="vm-set-row vm-set-inline">
            <span className="vm-set-line">
              <label className="vm-set-label" htmlFor="vm-set-advance">Auto-advance</label>
              <span className="vm-set-desc">After archiving or deleting, jump straight to the next conversation.</span>
            </span>
            <Toggle id="vm-set-advance" checked={settings.autoAdvance !== false} onChange={(v) => set({ autoAdvance: v })} />
          </div>
        </Section>

        <Section title="Appearance" icon="contrast">
          <div className="vm-set-row">
            <label className="vm-set-label">Theme</label>
            <Seg value={settings.theme} onChange={(v) => set({ theme: v })} ariaLabel="Theme"
              options={[
                { value: 'system', label: 'Auto', icon: 'contrast' },
                { value: 'dark', label: 'Dark', icon: 'moon' },
                { value: 'light', label: 'Light', icon: 'sun' },
              ]} />
            <p className="vm-set-desc">Auto follows your operating system’s light or dark setting.</p>
          </div>
        </Section>

        <Section title="Notifications" icon="bell">
          <div className="vm-set-row vm-set-inline">
            <span className="vm-set-line">
              <label className="vm-set-label" htmlFor="vm-set-notif">Desktop notifications</label>
              <span className="vm-set-desc">
                {notifDenied
                  ? 'Blocked in your browser settings — enable there first.'
                  : 'Alert me about new mail while this tab is open.'}
              </span>
            </span>
            <Toggle id="vm-set-notif" checked={!!settings.notifications && !notifDenied} onChange={toggleNotifications} />
          </div>
        </Section>

        <Section title="Calendar" icon="calendar">
          <div className="vm-set-row vm-set-inline">
            <span className="vm-set-line">
              <label className="vm-set-label" htmlFor="vm-set-cal">Calendar side panel</label>
              <span className="vm-set-desc">Show the mini month + agenda on the right (desktop).</span>
            </span>
            <Toggle id="vm-set-cal" checked={settings.calendarPanel !== false} onChange={(v) => set({ calendarPanel: v })} />
          </div>
        </Section>

        {labels.length > 0 && (
          <Section title="Labels" icon="tag">
            <ul className="vm-set-labels">
              {labels.map((l) => (
                <li key={l.path} className="vm-set-label-row">
                  <span className="vm-label-dot" style={{ background: `hsl(${labelHue(l.path)} 55% 55%)` }} aria-hidden="true" />
                  <span className="vm-set-label-name">{l.label}</span>
                </li>
              ))}
            </ul>
            <p className="vm-set-desc">Labels mirror your mail folders. Create or rename them in your mail provider.</p>
          </Section>
        )}

        {quota?.limit > 0 && (
          <Section title="Storage" icon="database">
            <div className="vm-set-row">
              <div className="vm-quota-bar vm-quota-bar-lg" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
                <span className={'vm-quota-fill' + (usedPct >= 90 ? ' vm-quota-full' : '')} style={{ width: usedPct + '%' }} />
              </div>
              <p className="vm-set-desc">{fmtBytes(quota.used)} of {fmtBytes(quota.limit)} used ({usedPct}%).</p>
            </div>
          </Section>
        )}

        <Section title="Composing" icon="pencil">
          <div className="vm-set-row">
            <label className="vm-set-label" htmlFor="vm-set-sig">Signature</label>
            <textarea id="vm-set-sig" className="vm-set-textarea" value={settings.signature}
              placeholder="Appended to new messages…" rows={4}
              onChange={(e) => set({ signature: e.target.value })} />
            <p className="vm-set-desc">Added to the bottom of new messages and replies.</p>
          </div>
        </Section>

        <Section title="Keyboard shortcuts" icon="keyboard">
          <div className="vm-set-row vm-set-inline">
            <span className="vm-set-line">
              <label className="vm-set-label" htmlFor="vm-set-shortcuts">Enable shortcuts</label>
              <span className="vm-set-desc">Gmail-style keys: j/k, e, #, r, c… Press ? for the full list.</span>
            </span>
            <Toggle id="vm-set-shortcuts" checked={settings.shortcuts} onChange={(v) => set({ shortcuts: v })} />
          </div>
          {onShowShortcuts && (
            <button type="button" className="vm-btn vm-btn-ghost vm-btn-block" onClick={onShowShortcuts}>
              <Icon name="keyboard" /> View all shortcuts
            </button>
          )}
        </Section>
      </div>
    </div>
  )
}

function Toggle({ id, checked, onChange }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked}
      className={'vm-toggle' + (checked ? ' vm-on' : '')} onClick={() => onChange(!checked)}>
      <span className="vm-toggle-knob" />
    </button>
  )
}
