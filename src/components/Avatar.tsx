// Renders inside any existing `.avatar`/`.bn-avatar`-style circle: a cover-fit photo when
// the person has one, falling back to their initials otherwise. Keeps every call site's own
// wrapper element/className/size overrides untouched — only the inner content changes.
export function avatarContent(person: { initials: string; avatarUrl?: string }) {
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
