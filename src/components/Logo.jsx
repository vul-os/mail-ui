import { useId, useState } from 'react'

/**
 * <Logo/> — the Vulos Mail brand mark.
 *
 * Renders the real product logo image (vulos-mail.png). Consumers serve the
 * image themselves at `src` — the default "/vulos-mail.png" is the path the
 * webmail (and this lib's demo) ship in public/vulos-mail.png. If the image
 * fails to load, it gracefully falls back to the token-driven SVG mark (a
 * geometric rounded tile holding an envelope whose flap folds into a "V", with
 * an unread "spark" dot) so the brand never renders blank.
 *
 * @param {object} props
 * @param {boolean} [props.wordmark=true] - render the "Vulos Mail" wordmark.
 * @param {string}  [props.src="/vulos-mail.png"] - logo image URL (served by the host app).
 * @param {string}  [props.className]
 */
export default function Logo({ wordmark = true, src = '/vulos-mail.png', className = '' }) {
  const gid = useId().replace(/[:]/g, '')
  const [failed, setFailed] = useState(false)
  return (
    <span className={'vm-logo' + (className ? ' ' + className : '')}>
      {src && !failed ? (
        <img
          className="vm-logo-mark"
          src={src}
          alt=""
          aria-hidden="true"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg className="vm-logo-mark" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id={`vmg-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--brand)" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <rect x="2" y="3.5" width="28" height="25" rx="8" fill={`url(#vmg-${gid})`} />
          {/* Envelope body + the flap that folds into a "V". */}
          <path
            d="M8.5 12.5 L16 19 L23.5 12.5"
            fill="none" stroke="var(--on-accent)" strokeWidth="2.3"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M9 12 L9 21.5 L23 21.5 L23 12"
            fill="none" stroke="var(--on-accent)" strokeWidth="2.3"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
          />
          {/* Unread "spark". */}
          <circle cx="24.5" cy="9.5" r="3" fill="var(--on-accent)" />
          <circle cx="24.5" cy="9.5" r="1.4" fill="var(--accent)" />
        </svg>
      )}
      {wordmark && (
        <span className="vm-logo-word">Vulos<b>Mail</b></span>
      )}
    </span>
  )
}
