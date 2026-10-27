// The house's own call buttons (house specs 0024 and 0027): microphone, camera and, in a call, screen share. Stream's prebuilt icon buttons have no
// accessible name, so every call in the house draws these instead. Each says its on or off state with aria-pressed. Used inside a StreamCall.
import { useCallStateHooks, type Call } from "@stream-io/video-react-sdk";
import { Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/dhi/ui/button";

export type DeviceWords = { microphone: string; camera: string; shareScreen: string };

export function DeviceButtons({ call, words, lobby = false }: { call: Call; words: DeviceWords; lobby?: boolean }) {
  const { useMicrophoneState, useCameraState, useScreenShareState } = useCallStateHooks();
  const mic = useMicrophoneState();
  const cam = useCameraState();
  const screen = useScreenShareState();
  const canShare = !lobby && typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const micOn = !mic.optimisticIsMute;
  const camOn = !cam.optimisticIsMute;
  const screenOn = !screen.optimisticIsMute;
  return (
    <>
      <Button variant={micOn ? "quiet" : "solid"} aria-pressed={micOn} onClick={() => void call.microphone.toggle()} data-testid="call-mic">
        {micOn ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
        {words.microphone}
      </Button>
      <Button variant={camOn ? "quiet" : "solid"} aria-pressed={camOn} onClick={() => void call.camera.toggle()} data-testid="call-camera">
        {camOn ? <Video className="size-4" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
        {words.camera}
      </Button>
      {canShare && (
        <Button variant="quiet" aria-pressed={screenOn} onClick={() => void call.screenShare.toggle()} data-testid="call-screen">
          <MonitorUp className="size-4" aria-hidden />
          {words.shareScreen}
        </Button>
      )}
    </>
  );
}
