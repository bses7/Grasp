/**
 * Webcam capture (doc 04, mediapipe-hands section 2). 640x360 is enough for a hand at arm's length;
 * more resolution costs inference time without improving landmarks. Frames stay in this tab.
 */
import { VISION_CONSTANTS } from "./constants";

/** Attach the user-facing camera to `video` and start playback. Rejects if permission is denied or no camera exists. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const { width, height, fps, facingMode } = VISION_CONSTANTS.CAMERA;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps }, facingMode },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
