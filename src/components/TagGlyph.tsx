import {
  BoltIcon,
  CalendarIcon,
  ChartIcon,
  ClipboardIcon,
  CodeIcon,
  CoffeeIcon,
  EditIcon,
  FlagIcon,
  FlaskIcon,
  GitPullRequestIcon,
  HeartPulseIcon,
  MessageIcon,
  PaletteIcon,
  SearchIcon,
  TagIcon,
  TargetIcon,
  VideoIcon,
} from './icons'
import { tagIconKey, type TagIconKey } from '../data/tags'

const ICONS: Record<TagIconKey, (p: { size: number; color: string }) => JSX.Element> = {
  code: (p) => <CodeIcon {...p} />,
  review: (p) => <GitPullRequestIcon {...p} />,
  video: (p) => <VideoIcon {...p} />,
  clipboard: (p) => <ClipboardIcon {...p} />,
  pencil: (p) => <EditIcon {...p} />,
  palette: (p) => <PaletteIcon {...p} />,
  flask: (p) => <FlaskIcon {...p} />,
  search: (p) => <SearchIcon {...p} />,
  calendar: (p) => <CalendarIcon {...p} />,
  chart: (p) => <ChartIcon {...p} />,
  target: (p) => <TargetIcon {...p} />,
  coffee: (p) => <CoffeeIcon {...p} />,
  message: (p) => <MessageIcon {...p} />,
  flag: (p) => <FlagIcon {...p} />,
  heart: (p) => <HeartPulseIcon {...p} />,
  bolt: (p) => <BoltIcon {...p} />,
}

export function IconByKey({ icon, size = 16, color = 'currentColor' }: { icon: TagIconKey; size?: number; color?: string }) {
  return ICONS[icon]({ size, color })
}

// The icon for a tag (by name), falling back to the plain tag glyph.
export default function TagGlyph({ name, size = 16, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const key = tagIconKey(name)
  return key ? <IconByKey icon={key} size={size} color={color} /> : <TagIcon size={size} color={color} />
}
