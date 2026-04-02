type MediaDevicesLike = Pick<MediaDevices, "getUserMedia">;

export function requestCaptureStream(
  mediaDevices: MediaDevicesLike = navigator.mediaDevices
): Promise<MediaStream> {
  return mediaDevices.getUserMedia({ audio: true });
}
