import { avatarColors, avatarInitial } from '../../lib/avatar'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { MenuButton, type MenuItem } from '../../ui/MenuButton'
import type { Profile } from '../../api/profiles'

/** What the meta strip shows: the three parts of a turn, then when the last one
 * was.
 *
 * Deliberately NOT the engine name or model id the profile actually stores --
 * "vieneu" and "qwen3-asr-flash" tell the person who set up a kitchen speaker
 * nothing. Those live one level down, in Configure.
 */
export type ProfileMeta = {
  /** Model Registry label for the pinned STT model. */
  hearing: string
  /** Model Registry label for the pinned LLM. */
  model: string
  /** TTS profile nickname, or the server default. */
  voice: string
  /** Human phrasing for the last conversation, e.g. "2 h ago". */
  lastUsed: string
}

export function ProfileCard({
  profile,
  meta,
  deviceCount,
  shared = false,
  onConfigure,
  onHistory,
  onDevices,
  onDuplicate,
  onDelete,
}: {
  profile: Profile
  meta: ProfileMeta
  deviceCount: number
  shared?: boolean
  onConfigure: () => void
  onHistory: () => void
  onDevices: () => void
  onDuplicate: () => void
  onDelete?: () => void
}) {
  const title = profile.nickname || profile.name
  const face = avatarColors(profile.name)

  // Shared templates are read-only to a normal user (only an admin can write to
  // one), so offering Delete would be a button that always fails.
  const menu: MenuItem[] = [{ label: 'Duplicate', onSelect: onDuplicate }]
  if (!shared && onDelete) {
    menu.push({ label: 'Delete', onSelect: onDelete, destructive: true })
  }

  return (
    <Card className="pcard">
      <div className="pcard__head">
        <span
          className="pcard__avatar"
          style={{ background: face.bg, color: face.fg }}
          aria-hidden="true"
        >
          {avatarInitial(title)}
        </span>
        <span className="pcard__title">
          {title}
          {shared && <span className="badge">shared</span>}
        </span>
        <MenuButton label={`More actions for ${title}`} items={menu} />
      </div>

      {/* In the order a turn actually happens -- hear, think, speak -- so the
          three rows are a path rather than a list. "Hearing" and not "STT" or
          "Listening": it is the mirror of Voice, and "listening" already names a
          live state on Talk.

          title carries the untruncated value: a voice name can still outrun its
          row on a narrow card, and hovering is cheaper than opening Configure. */}
      <dl className="pcard__meta">
        <div className="pcard__cell">
          <dt>Hearing</dt>
          <dd title={meta.hearing}>{meta.hearing}</dd>
        </div>
        <div className="pcard__cell">
          <dt>Model</dt>
          <dd title={meta.model}>{meta.model}</dd>
        </div>
        <div className="pcard__cell">
          <dt>Voice</dt>
          <dd title={meta.voice}>{meta.voice}</dd>
        </div>
        <div className="pcard__cell">
          <dt>Last used</dt>
          <dd>{meta.lastUsed}</dd>
        </div>
      </dl>

      <div className="pcard__actions">
        {!shared && (
          <Button variant="secondary" size="sm" data-act="configure" onClick={onConfigure}>
            Configure
          </Button>
        )}
        <Button variant="secondary" size="sm" data-act="history" onClick={onHistory}>
          History
        </Button>
        {/* The one number that answers "what is this assistant running on?" -- the
            question the old two-parallel-lists UI could not answer at all. */}
        <Button variant="secondary" size="sm" data-act="devices" onClick={onDevices}>
          Devices ({deviceCount})
        </Button>
      </div>
    </Card>
  )
}
