import CapAvatar from './CapAvatar'
import pranathAvatar from '../assets/pranath-avatar.png'

// Renders inside any existing `.avatar`/`.bn-avatar`-style circle: a cover-fit photo when
// the person has one, falling back to their initials otherwise. Keeps every call site's own
// wrapper element/className/size overrides untouched — only the inner content changes.
// The founder's illustration can play a cap-tipping loop — opt in with { animate: true } (used in the
// nav bar and on the person's own profile page only). Any other picture, or an uploaded replacement,
// renders as a normal image.
export function avatarContent(person: { initials: string; avatarUrl?: string }, options?: { animate?: boolean }) {
  if (options?.animate && person.avatarUrl && person.avatarUrl === pranathAvatar) {
    return <CapAvatar src={person.avatarUrl} />
  }
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
      />
    )
  }
  return person.initials
}
