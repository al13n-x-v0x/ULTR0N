/** Camera + screen enumeration/permission helpers — all gated behind explicit user action. */

export interface CamDevice {
  deviceId: string
  label: string
}

export async function listCameras(): Promise<CamDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    const devs = await navigator.mediaDevices.enumerateDevices()
    return devs.filter((d) => d.kind === 'videoinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
  } catch { return [] }
}

export async function openCamera(deviceId?: string): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  return stream
}

export async function openScreen(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({ video: true })
}

export function closeStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}

export function streamOk(stream: MediaStream | null): boolean {
  return !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live')
}
