import type { CSSProperties } from 'react'

export type IconName =
  | 'logo' | 'home' | 'chat' | 'folder' | 'mic' | 'eye' | 'globe' | 'phone' | 'bolt' | 'brain'
  | 'code' | 'grid' | 'settings' | 'bell' | 'search' | 'send' | 'close' | 'check' | 'plus' | 'minus'
  | 'chevR' | 'chevL' | 'chevD' | 'chevU' | 'paperclip' | 'camera' | 'monitor' | 'play' | 'stop' | 'pause'
  | 'refresh' | 'trash' | 'edit' | 'kbd' | 'user' | 'cpu' | 'activity' | 'radar' | 'wifi' | 'battery'
  | 'bluetooth' | 'tv' | 'watch' | 'headphones' | 'gamepad' | 'speaker' | 'alert' | 'info' | 'spark'
  | 'mode' | 'palette' | 'shield' | 'star' | 'clock' | 'download' | 'maximize' | 'minimize' | 'window'
  | 'database' | 'layers' | 'target' | 'zap' | 'sun' | 'moon' | 'file' | 'list' | 'scan' | 'link'
  | 'arrowR' | 'arrowL' | 'dot' | 'power' | 'volume' | 'volumeX' | 'switchCam' | 'circle' | 'square'
  | 'copy'

interface IconProps {
  name: IconName
  width?: number
  height?: number
  style?: CSSProperties
  className?: string
}

const P: Record<IconName, string> = {
  logo: 'M12 2 L22 20 L2 20 Z M12 9 L17.5 19 L6.5 19 Z',
  home: 'M3 10.5 L12 3 L21 10.5 M5 9.5 V21 H19 V9.5',
  chat: 'M4 5 h16 v11 h-9 l-4 4 v-4 H4 Z',
  folder: 'M3 6 h6 l2 2 h10 v11 H3 Z',
  mic: 'M12 3 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -6 0 V6 a3 3 0 0 1 3 -3 Z M6 11 a6 6 0 0 0 12 0 M12 17 v4 M9 21 h6',
  eye: 'M2 12 C5 6.5 9 4.5 12 4.5 S19 6.5 22 12 C19 17.5 15 19.5 12 19.5 S5 17.5 2 12 Z M12 9 a3 3 0 1 0 0 6 a3 3 0 1 0 0 -6',
  globe: 'M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18 M3 12 h18 M12 3 c2.5 2.7 3.8 5.8 3.8 9 s-1.3 6.3 -3.8 9 c-2.5 -2.7 -3.8 -5.8 -3.8 -9 s1.3 -6.3 3.8 -9',
  phone: 'M8 2 h8 a1.5 1.5 0 0 1 1.5 1.5 v17 a1.5 1.5 0 0 1 -1.5 1.5 H8 a1.5 1.5 0 0 1 -1.5 -1.5 V3.5 A1.5 1.5 0 0 1 8 2 Z M10.5 18.5 h3',
  bolt: 'M13 2 L5 13 h5 l-1.5 9 L19 10 h-5.5 Z',
  brain: 'M9 3 a3.2 3.2 0 0 0 -3.2 3.2 c-1.8 0.6 -2.8 2 -2.8 3.8 c0 1.2 0.5 2.2 1.3 3 c-0.8 0.8 -1.3 1.8 -1.3 3 c0 2 1.5 3.6 3.5 3.8 A3.4 3.4 0 0 0 9 21 a3 3 0 0 0 3 -3 V6 a3 3 0 0 0 -3 -3 Z M15 3 a3 3 0 0 1 3 3 v0.2 c1.8 0.6 2.8 2 2.8 3.8 c0 1.2 -0.5 2.2 -1.3 3 c0.8 0.8 1.3 1.8 1.3 3 c0 2 -1.5 3.6 -3.5 3.8 A3.4 3.4 0 0 1 15 21 a3 3 0 0 1 -3 -3',
  code: 'M8 6 L2.5 12 L8 18 M16 6 L21.5 12 L16 18 M13.5 4 L10.5 20',
  grid: 'M4 4 h6 v6 H4 Z M14 4 h6 v6 h-6 Z M4 14 h6 v6 H4 Z M14 14 h6 v6 h-6 Z',
  settings: 'M12 8.5 a3.5 3.5 0 1 0 0 7 a3.5 3.5 0 1 0 0 -7 M19.4 15 a1.65 1.65 0 0 0 0.33 1.82 l0.06 0.06 a2 2 0 1 1 -2.83 2.83 l-0.06 -0.06 a1.65 1.65 0 0 0 -1.82 -0.33 a1.65 1.65 0 0 0 -1 1.51 V21 a2 2 0 1 1 -4 0 v-0.09 a1.65 1.65 0 0 0 -1 -1.51 a1.65 1.65 0 0 0 -1.82 0.33 l-0.06 0.06 a2 2 0 1 1 -2.83 -2.83 l0.06 -0.06 a1.65 1.65 0 0 0 0.33 -1.82 a1.65 1.65 0 0 0 -1.51 -1 H3 a2 2 0 1 1 0 -4 h0.09 a1.65 1.65 0 0 0 1.51 -1 a1.65 1.65 0 0 0 -0.33 -1.82 l-0.06 -0.06 a2 2 0 1 1 2.83 -2.83 l0.06 0.06 a1.65 1.65 0 0 0 1.82 0.33 h0 a1.65 1.65 0 0 0 1 -1.51 V3 a2 2 0 1 1 4 0 v0.09 a1.65 1.65 0 0 0 1 1.51 h0 a1.65 1.65 0 0 0 1.82 -0.33 l0.06 -0.06 a2 2 0 1 1 2.83 2.83 l-0.06 0.06 a1.65 1.65 0 0 0 -0.33 1.82 v0 a1.65 1.65 0 0 0 1.51 1 H21 a2 2 0 1 1 0 4 h-0.09 a1.65 1.65 0 0 0 -1.51 1 Z',
  bell: 'M6 9 a6 6 0 0 1 12 0 c0 5 2 6 2 6 H4 s2 -1 2 -6 M10 19 a2 2 0 0 0 4 0',
  search: 'M11 4 a7 7 0 1 0 0 14 a7 7 0 1 0 0 -14 M21 21 l-4.35 -4.35',
  send: 'M22 2 L11 13 M22 2 L15 22 l-4 -9 l-9 -4 Z',
  close: 'M5 5 L19 19 M19 5 L5 19',
  check: 'M4 12.5 L9.5 18 L20 6.5',
  plus: 'M12 5 v14 M5 12 h14',
  minus: 'M5 12 h14',
  chevR: 'M9 5 l7 7 l-7 7',
  chevL: 'M15 5 l-7 7 l7 7',
  chevD: 'M5 9 l7 7 l7 -7',
  chevU: 'M5 15 l7 -7 l7 7',
  paperclip: 'M21 11.5 l-8.5 8.5 a5.5 5.5 0 0 1 -7.8 -7.8 L13 4 a3.7 3.7 0 0 1 5.2 5.2 L10 17 a1.8 1.8 0 0 1 -2.6 -2.6 L15 7',
  camera: 'M4 7 h3 l2 -2.5 h6 L17 7 h3 a1 1 0 0 1 1 1 v11 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V8 a1 1 0 0 1 1 -1 Z M12 10 a4 4 0 1 0 0 8 a4 4 0 1 0 0 -8',
  monitor: 'M3 4 h18 v12 H3 Z M9 20 h6 M12 16 v4',
  play: 'M7 4 l13 8 l-13 8 Z',
  stop: 'M6 6 h12 v12 H6 Z',
  pause: 'M7 5 h3.5 v14 H7 Z M13.5 5 H17 v14 h-3.5 Z',
  refresh: 'M20 11 a8 8 0 1 0 -0.7 5.5 M20 5 v6 h-6',
  trash: 'M4 7 h16 M9 7 V4 h6 v3 M6.5 7 l1 13.5 h9 l1 -13.5 M10 11 v6 M14 11 v6',
  edit: 'M17 3 l4 4 L8 20 H4 v-4 Z',
  kbd: 'M3 6.5 h18 v11 H3 Z M7 10 h0.5 M11 10 h0.5 M15 10 h0.5 M7 14 h10',
  user: 'M12 12 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M4.5 21 a7.5 7.5 0 0 1 15 0',
  cpu: 'M8 8 h8 v8 H8 Z M5 5 h14 v14 H5 Z M9 2 v3 M15 2 v3 M9 19 v3 M15 19 v3 M2 9 h3 M2 15 h3 M19 9 h3 M19 15 h3',
  activity: 'M2 12 h4 l2.5 -7 l4 14 l2.5 -7 h7',
  radar: 'M12 12 m0 -1 a1 1 0 1 1 0 2 a1 1 0 1 1 0 -2 M12 12 L19 7 M12 3 a9 9 0 1 0 9 9 M16 3.5 a9 9 0 0 1 4.5 5 M12 7.5 a4.5 4.5 0 1 0 4.5 4.5',
  wifi: 'M2.5 9 a14 14 0 0 1 19 0 M6 12.5 a9 9 0 0 1 12 0 M9.5 16 a4.5 4.5 0 0 1 5 0 M12 19.5 h0.01',
  battery: 'M2 7 h16 v10 H2 Z M20 10.5 v3 M5.5 10 h7 v4 h-7 Z',
  bluetooth: 'M6.5 7 L17 17 L12 21 V3 l5 4 L6.5 17',
  tv: 'M3 5 h18 v11 H3 Z M8 20 h8 M12 16 v4',
  watch: 'M9 3 h6 l0.6 3.2 a6 6 0 0 1 0 11.6 L15 21 H9 l-0.6 -3.2 a6 6 0 0 1 0 -11.6 Z M12 9 v3.5 l2.5 1.5',
  headphones: 'M4 18 v-5 a8 8 0 0 1 16 0 v5 M4 13 h3 v7 H5 a1 1 0 0 1 -1 -1 Z M20 13 h-3 v7 h2 a1 1 0 0 0 1 -1 Z',
  gamepad: 'M6 9 h12 a4.5 4.5 0 0 1 4.5 5 l-0.8 4 a2 2 0 0 1 -3.6 0.8 L16.5 16 h-9 l-1.6 2.8 a2 2 0 0 1 -3.6 -0.8 L1.5 14 A4.5 4.5 0 0 1 6 9 Z M8 12 v3 M6.5 13.5 h3 M15.5 12.5 h0.01 M18 14.5 h0.01',
  speaker: 'M4 9 h4 l5 -4.5 v15 L8 15 H4 Z M16.5 8.5 a5 5 0 0 1 0 7 M19 6 a9 9 0 0 1 0 12',
  alert: 'M12 3 L22.5 21 H1.5 Z M12 9.5 v5 M12 17.2 h0.01',
  info: 'M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18 M12 10.5 v6 M12 7.2 h0.01',
  spark: 'M12 2 l2.2 6.8 L21 11 l-6.8 2.2 L12 20 l-2.2 -6.8 L3 11 l6.8 -2.2 Z',
  mode: 'M12 3 a9 9 0 1 0 9 9 c0 -1 -0.8 -2 -2 -2 h-3 a2 2 0 0 1 -2 -2 V5 c0 -1.2 -1 -2 -2 -2 Z M7.5 10.5 h0.01 M9.5 14.5 h0.01',
  palette: 'M12 21 a9 9 0 1 1 9 -9 c0 2 -1.5 3.5 -3.5 3.5 H15 a2 2 0 0 0 -1.5 3.3 c0.4 0.5 0.3 1.2 -0.3 1.6 a8.9 8.9 0 0 1 -1.2 0.6 M7.5 10.5 h0.01 M11 7.5 h0.01 M15.5 8.5 h0.01',
  shield: 'M12 2 l8 3.5 v5.5 c0 5 -3.5 8.5 -8 11 c-4.5 -2.5 -8 -6 -8 -11 V5.5 Z M8.5 12 l2.5 2.5 l4.5 -5',
  star: 'M12 2.5 l2.9 5.9 6.6 1 -4.7 4.6 1.1 6.5 -5.9 -3.1 -5.9 3.1 1.1 -6.5 L2.5 9.4 l6.6 -1 Z',
  clock: 'M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18 M12 7 v5 l3.5 2',
  download: 'M12 3 v12 M7 10 l5 5 l5 -5 M4 21 h16',
  maximize: 'M8 3 H3 v5 M16 3 h5 v5 M8 21 H3 v-5 M16 21 h5 v-5',
  minimize: 'M14 3 h7 v7 M10 21 H3 v-7 M21 14 l-7 7 M3 10 l7 -7',
  window: 'M3 5 h18 v14 H3 Z M3 9 h18 M6.5 7 h0.01 M9.5 7 h0.01',
  database: 'M12 8 c4.4 0 8 -1.3 8 -3 s-3.6 -3 -8 -3 s-8 1.3 -8 3 s3.6 3 8 3 M4 5 v14 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3 V5 M4 12 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3',
  layers: 'M12 2 L22 7.5 L12 13 L2 7.5 Z M2 12.5 L12 18 l10 -5.5 M2 17 L12 22.5 L22 17',
  target: 'M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18 M12 16.5 a4.5 4.5 0 1 0 0 -9 a4.5 4.5 0 1 0 0 9 M12 13 a1 1 0 1 0 0 -2 a1 1 0 1 0 0 2',
  zap: 'M13 2 L5 13 h5 l-1.5 9 L19 10 h-5.5 Z',
  sun: 'M12 17 a5 5 0 1 0 0 -10 a5 5 0 0 0 0 10 M12 1.5 v3 M12 19.5 v3 M1.5 12 h3 M19.5 12 h3 M4.6 4.6 l2.1 2.1 M17.3 17.3 l2.1 2.1 M4.6 19.4 l2.1 -2.1 M17.3 6.7 l2.1 -2.1',
  moon: 'M21 13.5 A9 9 0 1 1 10.5 3 a7.5 7.5 0 0 0 10.5 10.5 Z',
  file: 'M6 2 h8 l5 5 v15 H6 Z M14 2 v5 h5',
  list: 'M8 6 h13 M8 12 h13 M8 18 h13 M3.5 6 h0.01 M3.5 12 h0.01 M3.5 18 h0.01',
  scan: 'M4 8 V5 a1 1 0 0 1 1 -1 h3 M16 4 h3 a1 1 0 0 1 1 1 v3 M20 16 v3 a1 1 0 0 1 -1 1 h-3 M8 20 H5 a1 1 0 0 1 -1 -1 v-3 M3 12 h18',
  link: 'M10 14 a5 5 0 0 0 7.5 0.5 l3 -3 a5 5 0 0 0 -7 -7 l-1.7 1.7 M14 10 a5 5 0 0 0 -7.5 -0.5 l-3 3 a5 5 0 0 0 7 7 l1.7 -1.7',
  arrowR: 'M4 12 h16 M13 5 l7 7 l-7 7',
  arrowL: 'M20 12 H4 M11 5 l-7 7 l7 7',
  dot: 'M12 12 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0',
  power: 'M12 3 v9 M18.4 6.6 a9 9 0 1 1 -12.8 0',
  volume: 'M4 9 h4 l5 -4.5 v15 L8 15 H4 Z M16.5 8.5 a5 5 0 0 1 0 7',
  volumeX: 'M4 9 h4 l5 -4.5 v15 L8 15 H4 Z M16 9 l5 6 M21 9 l-5 6',
  switchCam: 'M4 9 a8 8 0 0 1 14 -3 M20 15 a8 8 0 0 1 -14 3 M18 2 v4 h-4 M6 22 v-4 h4',
  circle: 'M12 21 a9 9 0 1 0 0 -18 a9 9 0 1 0 0 18',
  square: 'M5 5 h14 v14 H5 Z',
  copy: 'M9 9 h11 v11 H9 Z M15 9 V4 H4 v11 h5',
}

export function Icon({ name, width = 17, height, style, className }: IconProps) {
  const d = P[name] ?? P.circle
  const ring = name === 'logo'
  return (
    <svg
      width={width}
      height={height ?? width}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ring ? 1.6 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
