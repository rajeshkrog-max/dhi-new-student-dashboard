// The study hour call (house spec 0027; the owner's answers of 2026-10-28), on Stream Video, loaded only when it is opened (React.lazy). One call
// for each hour and institute: camera and voice, recorded, camera and microphone off when joining. A student joins from a Live seat; a teacher or a
// DHI admin joins as a moderator and may mute or remove a person. The grid is Stream's; the buttons are the house's own, each with a name.
import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import {
  CallingState,
  DefaultParticipantViewUI,
  PaginatedGridLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import { PhoneOff } from "lucide-react";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { DeviceButtons } from "@/components/dhi/call/device-buttons";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { HOUR_CALL_WORDS, hourCallRefusal } from "@/lib/dhi/hour-call-words";

type Props = { instituteId?: GenericId<"institutes">; onDone: () => void };

export default function HourCall({ instituteId, onDone }: Props) {
  const joinHourCall = useAction(api.hourCall.joinHourCall);
  const [client, setClient] = useState<StreamVideoClient>();
  const [call, setCall] = useState<Call>();
  const [moderator, setModerator] = useState(false);
  const [error, setError] = useState("");

  // One client for this call screen, disconnected when the screen closes (a mode change away from Live unmounts it).
  useEffect(() => {
    let made: StreamVideoClient | undefined;
    let joined: Call | undefined;
    let cancelled = false;
    (async () => {
      const args = instituteId ? { instituteId } : {};
      const first = await joinHourCall(args);
      if (cancelled) return;
      if (!first.ok) {
        setError(hourCallRefusal(first.code));
        return;
      }
      const tokenProvider = async () => {
        const again = await joinHourCall(args);
        if (!again.ok) throw new Error(again.code);
        return again.token;
      };
      made = new StreamVideoClient({ apiKey: first.apiKey, user: first.user, token: first.token, tokenProvider });
      const c = made.call(first.callType, first.callId);
      joined = c;
      await c.join({ create: false });
      await c.camera.disable().catch(() => undefined);
      await c.microphone.disable().catch(() => undefined);
      if (cancelled) {
        await c.leave().catch(() => undefined);
        return;
      }
      setModerator(first.moderator);
      setClient(made);
      setCall(c);
    })().catch(() => !cancelled && setError(HOUR_CALL_WORDS.failed));
    // Leaving the screen leaves the call, then ends the client. This is the one place a call is left on unmount: a second cleanup elsewhere would
    // leave the call React's development mode just joined.
    return () => {
      cancelled = true;
      const client = made;
      void (joined?.leave() ?? Promise.resolve()).catch(() => undefined).finally(() => client?.disconnectUser().catch(() => undefined));
      setClient(undefined);
      setCall(undefined);
    };
  }, [instituteId, joinHourCall]);

  if (error) {
    return (
      <Notice tone="danger" role="alert" className="px-4 py-3 text-sm" data-testid="hour-call-error">
        {error}
      </Notice>
    );
  }
  if (!client || !call) return <p className="text-sm text-mute">{HOUR_CALL_WORDS.loading}</p>;

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <StreamTheme className="dhi-call">
          <Stage call={call} moderator={moderator} onDone={onDone} />
        </StreamTheme>
      </StreamCall>
    </StreamVideo>
  );
}

const TILE = <DefaultParticipantViewUI showMenuButton={false} />;

function Stage({ call, moderator, onDone }: { call: Call; moderator: boolean; onDone: () => void }) {
  const { useCallCallingState, useIsCallRecordingInProgress, useParticipants } = useCallStateHooks();
  const state = useCallCallingState();
  const recording = useIsCallRecordingInProgress();
  const people = useParticipants();

  if (state !== CallingState.JOINED) return <p className="text-sm text-mute">{HOUR_CALL_WORDS.joining}</p>;
  return (
    <div className="space-y-3" data-testid="hour-call-live">
      <p className="text-xs text-mute" role="status" data-testid="hour-call-recording" data-on={recording ? "true" : "false"}>
        {recording ? HOUR_CALL_WORDS.recordedNow : HOUR_CALL_WORDS.recordingSoon}
      </p>
      {moderator && <p className="text-xs text-mute">{HOUR_CALL_WORDS.moderating}</p>}
      <PaginatedGridLayout groupSize={9} ParticipantViewUI={TILE} />
      <div className="flex flex-wrap justify-center gap-2">
        <DeviceButtons call={call} words={HOUR_CALL_WORDS} />
        <Button variant="quiet" onClick={() => void call.leave().finally(onDone)} data-testid="hour-call-leave">
          <PhoneOff className="size-4" aria-hidden />
          {HOUR_CALL_WORDS.leave}
        </Button>
      </div>
      {moderator && (
        <div className="space-y-2" data-testid="hour-call-people">
          <h3 className="text-xs font-medium text-mute">{HOUR_CALL_WORDS.people}</h3>
          <ul className="space-y-1">
            {people
              .filter((p) => !p.isLocalParticipant)
              .map((p) => (
                <li key={p.sessionId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.name || p.userId}</span>
                  <Button variant="quiet" onClick={() => void call.muteUser(p.userId, "audio").catch(() => undefined)} aria-label={`${HOUR_CALL_WORDS.mute} ${p.name}`}>
                    {HOUR_CALL_WORDS.mute}
                  </Button>
                  <Button variant="quiet" onClick={() => void call.blockUser(p.userId).catch(() => undefined)} aria-label={`${HOUR_CALL_WORDS.remove} ${p.name}`}>
                    {HOUR_CALL_WORDS.remove}
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
