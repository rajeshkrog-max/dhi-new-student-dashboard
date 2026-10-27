// The counseling call (spec house/0024), on Stream Video's prebuilt components, loaded only when a call is opened (React.lazy). A lobby first: a
// preview of the camera, the microphone and camera toggles and the notice that the call is recorded. Then the call: the speaker layout, whether the
// recording is on, and the house's own buttons (microphone, camera, share screen, leave), each with a name and its on or off state, because Stream's
// icon buttons have no name for a screen reader. The token comes from the backend (`counselCall.joinCall`) and is for this one call only.
import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import {
  CallingState,
  DefaultParticipantViewUI,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
  VideoPreview,
  useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { api } from "@dhi/backend/api";
import type { GenericId } from "convex/values";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { COUNSEL_WORDS, counselRefusal } from "@/lib/dhi/counsel-words";

type Props = { bookingId: GenericId<"counselBookings">; onDone: () => void };

export default function CounselCall({ bookingId, onDone }: Props) {
  const joinCall = useAction(api.counselCall.joinCall);
  const [client, setClient] = useState<StreamVideoClient>();
  const [call, setCall] = useState<Call>();
  const [error, setError] = useState("");

  // One client for this call screen: made once in the effect with its token provider, and disconnected when the screen closes.
  useEffect(() => {
    let made: StreamVideoClient | undefined;
    let cancelled = false;
    (async () => {
      const first = await joinCall({ bookingId });
      if (cancelled) return;
      if (!first.ok) {
        setError(counselRefusal(first.code));
        return;
      }
      const tokenProvider = async () => {
        const again = await joinCall({ bookingId });
        if (!again.ok) throw new Error(again.code);
        return again.token;
      };
      made = new StreamVideoClient({ apiKey: first.apiKey, user: first.user, token: first.token, tokenProvider });
      const c = made.call(first.callType, first.callId);
      await c.get();
      if (cancelled) return;
      setClient(made);
      setCall(c);
    })().catch(() => !cancelled && setError(COUNSEL_WORDS.callFailed));
    return () => {
      cancelled = true;
      made?.disconnectUser().catch(() => undefined);
      setClient(undefined);
      setCall(undefined);
    };
  }, [bookingId, joinCall]);

  if (error) {
    return (
      <div className="space-y-3">
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm" data-testid="counsel-call-error">
          {error}
        </Notice>
        <Button variant="quiet" onClick={onDone}>
          {COUNSEL_WORDS.back}
        </Button>
      </div>
    );
  }
  if (!client || !call) return <p className="text-sm text-mute">{COUNSEL_WORDS.callLoading}</p>;

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <StreamTheme className="dhi-counsel-call">
          <CallStage call={call} onDone={onDone} />
        </StreamTheme>
      </StreamCall>
    </StreamVideo>
  );
}

// A tile without its menu (pin, full screen and the like), which has no name for a screen reader and is not needed for two people.
const TILE = <DefaultParticipantViewUI showMenuButton={false} />;

// The microphone and camera switches, and in the call the screen share where the browser has one. Each says its on or off state with aria-pressed.
function DeviceButtons({ call, lobby = false }: { call: Call; lobby?: boolean }) {
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
      <Button variant={micOn ? "quiet" : "solid"} aria-pressed={micOn} onClick={() => void call.microphone.toggle()} data-testid="counsel-mic">
        {micOn ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
        {COUNSEL_WORDS.microphone}
      </Button>
      <Button variant={camOn ? "quiet" : "solid"} aria-pressed={camOn} onClick={() => void call.camera.toggle()} data-testid="counsel-camera">
        {camOn ? <Video className="size-4" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
        {COUNSEL_WORDS.camera}
      </Button>
      {canShare && (
        <Button variant="quiet" aria-pressed={screenOn} onClick={() => void call.screenShare.toggle()} data-testid="counsel-screen">
          <MonitorUp className="size-4" aria-hidden />
          {COUNSEL_WORDS.shareScreen}
        </Button>
      )}
    </>
  );
}

function CallStage({ call, onDone }: { call: Call; onDone: () => void }) {
  const { useCallCallingState, useIsCallRecordingInProgress } = useCallStateHooks();
  const state = useCallCallingState();
  const recording = useIsCallRecordingInProgress();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Leaving the screen leaves the call too.
  useEffect(() => () => void call.leave().catch(() => undefined), [call]);

  if (state === CallingState.JOINED) {
    return (
      <div className="space-y-3" data-testid="counsel-call-live">
        <p className="text-xs text-mute" role="status" data-testid="counsel-recording" data-on={recording ? "true" : "false"}>
          {recording ? COUNSEL_WORDS.recordedNow : COUNSEL_WORDS.recordingSoon}
        </p>
        <SpeakerLayout participantsBarPosition="bottom" ParticipantViewUISpotlight={TILE} ParticipantViewUIBar={TILE} />
        <div className="flex flex-wrap justify-center gap-2">
          <DeviceButtons call={call} />
          <Button
            variant="quiet"
            onClick={() => void call.leave().finally(onDone)}
            data-testid="counsel-leave"
          >
            <PhoneOff className="size-4" aria-hidden />
            {COUNSEL_WORDS.leave}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="counsel-lobby">
      <Notice role="status" className="px-4 py-3 text-sm">
        {COUNSEL_WORDS.recordedNotice}
      </Notice>
      <div className="mx-auto max-w-md overflow-hidden rounded-card">
        <VideoPreview />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <DeviceButtons call={call} lobby />
      </div>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          disabled={joining}
          data-testid="counsel-join"
          onClick={async () => {
            setJoining(true);
            setError("");
            try {
              await call.join();
            } catch {
              setError(COUNSEL_WORDS.callFailed);
            } finally {
              setJoining(false);
            }
          }}
        >
          {joining ? COUNSEL_WORDS.joining : COUNSEL_WORDS.join}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          {COUNSEL_WORDS.back}
        </Button>
      </div>
    </div>
  );
}
