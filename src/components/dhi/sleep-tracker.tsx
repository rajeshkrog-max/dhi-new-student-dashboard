// The sleep room (spec house/0008). A signed in student records last night's sleep: a bed time and a length, in steps of 15 minutes. The
// server holds the nights; this screen reads them with `sleep.recent` and saves through `sleep.save`. The read back (the usual bedtime and the
// average length) is worked out here when the student looks, and never stored.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { shiftDay, todayOf } from "@dhi/backend/dayRules";
import {
  DEFAULT_BED_MIN,
  DEFAULT_LENGTH_MIN,
  MAX_LENGTH_MIN,
  MIN_LENGTH_MIN,
  STEP_MIN,
  averageLengthMin,
  bedMinToClock,
  clockText,
  usualBedMin,
  wakeClockOf,
} from "@dhi/backend/sleepRules";
import {
  AVERAGE_LENGTH,
  BED_EARLIER,
  BED_LABEL,
  BED_LATER,
  DRAFT_NOTE,
  FEW_NIGHTS,
  LAST_NIGHT,
  LOADING,
  NIGHT_MOVED_ON,
  NOT_LOGGED,
  SAVE,
  SAVED,
  SLEEP_WORDS_APPROVED,
  TRACK_NOTE,
  USUAL_BEDTIME,
  WAKE_EARLIER,
  WAKE_LABEL,
  WAKE_LATER,
  WEEK_TITLE,
  sleepRefusal,
} from "@/lib/dhi/sleep-words";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";

const WEEK = 7;
const WINDOW_DAYS = 30;
const DAY_MINUTES = 1440;

const wrap = (minute: number) => ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
const clamp = (length: number) => Math.min(MAX_LENGTH_MIN, Math.max(MIN_LENGTH_MIN, length));
const hm = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;

// A label for a house day, in plain words. The day key is read at noon India time, so no zone can shift the date.
const dayLabel = (day: string) => new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// The bar for one night on the noon shifted track. A night that runs past the end of the track is drawn as two pieces.
function nightBars(bedMin: number, lengthMin: number): { top: number; height: number }[] {
  const end = bedMin + lengthMin;
  if (end <= DAY_MINUTES) return [{ top: (bedMin / DAY_MINUTES) * 100, height: (lengthMin / DAY_MINUTES) * 100 }];
  return [
    { top: (bedMin / DAY_MINUTES) * 100, height: ((DAY_MINUTES - bedMin) / DAY_MINUTES) * 100 },
    { top: 0, height: ((end - DAY_MINUTES) / DAY_MINUTES) * 100 },
  ];
}

// A clock on the form that also takes a typed time: tapping it opens the device's own time picker. The time is rounded to the nearest 15 minutes,
// the step the room stores.
function ClockTap({ text, label, testId, onPick }: { text: string; label: string; testId: string; onPick: (clock: number) => void }) {
  return (
    <label className="relative min-w-14 cursor-pointer text-center font-medium tabular-nums" data-testid={testId}>
      {text}
      <input
        type="time"
        step={STEP_MIN * 60}
        value={text}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          if (Number.isFinite(h) && Number.isFinite(m)) onPick(wrap(Math.round((h * 60 + m) / STEP_MIN) * STEP_MIN));
        }}
      />
    </label>
  );
}

export function SleepTracker() {
  const nights = useQuery(api.sleep.recent, {});
  const saveNight = useMutation(api.sleep.save);
  const [today, setToday] = useState(() => todayOf(Date.now()));
  const [bedMin, setBedMin] = useState(DEFAULT_BED_MIN);
  const [lengthMin, setLengthMin] = useState(DEFAULT_LENGTH_MIN);
  // `dirty` is true while the student has changed the form and not yet saved what they see.
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fail, setFail] = useState("");
  const [movedOn, setMovedOn] = useState(false);
  // What is on the form right now, so a save that returns can tell whether the student kept changing it while it was in flight.
  const form = useRef({ bedMin, lengthMin });
  form.current = { bedMin, lengthMin };
  const todayRef = useRef(today);

  // The night moves on at 04:00: look again once a minute, and say so when it has moved.
  useEffect(() => {
    const id = setInterval(() => {
      const now = todayOf(Date.now());
      if (now !== todayRef.current) {
        todayRef.current = now;
        setToday(now);
        // The draft belonged to the old night, so the form follows the new one.
        setDirty(false);
        setMovedOn(true);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // The form follows the newest logged night, whatever its age, until the student edits it.
  useEffect(() => {
    if (nights === undefined || dirty) return;
    setBedMin(nights[0]?.bedMin ?? DEFAULT_BED_MIN);
    setLengthMin(nights[0]?.lengthMin ?? DEFAULT_LENGTH_MIN);
  }, [nights, dirty]);

  const tonight = nights?.find((n) => n.day === today);
  const unchanged = tonight !== undefined && !dirty && tonight.bedMin === bedMin && tonight.lengthMin === lengthMin;

  // The read back over the display day and the 29 days before it. Worked out here, never stored.
  const inWindow = useMemo(() => {
    const from = shiftDay(today, -(WINDOW_DAYS - 1));
    return (nights ?? []).filter((n) => n.day >= from && n.day <= today);
  }, [nights, today]);
  const usual = usualBedMin(inWindow);
  const average = averageLengthMin(inWindow);
  const week = useMemo(() => Array.from({ length: WEEK }, (_, i) => shiftDay(today, i - (WEEK - 1))), [today]);

  async function save() {
    setFail("");
    setSaving(true);
    const sent = { bedMin, lengthMin };
    try {
      const r = await saveNight(sent);
      if (!r.ok) {
        setFail(sleepRefusal(r.code));
      } else {
        if (r.day !== todayRef.current) {
          todayRef.current = r.day;
          setToday(r.day);
          setMovedOn(true);
        }
        // Only a form that still holds what was sent is clean again; anything typed meanwhile is kept.
        const same = form.current.bedMin === sent.bedMin && form.current.lengthMin === sent.lengthMin;
        if (same) setDirty(false);
      }
    } catch (error) {
      setFail(sleepRefusal(error));
    }
    setSaving(false);
  }

  const bed = clockText(bedMinToClock(bedMin));
  const wake = clockText(wakeClockOf(bedMin, lengthMin));

  return (
    <div className="space-y-4" data-testid="sleep-room">
      {movedOn && (
        <Notice role="status" data-testid="sleep-moved-on" className="px-4 py-3 text-sm">
          {NIGHT_MOVED_ON}
        </Notice>
      )}
      {!SLEEP_WORDS_APPROVED && (
        <p className="text-xs text-mute touch:text-sm" data-testid="sleep-draft">
          {DRAFT_NOTE}
        </p>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">{LAST_NIGHT}</h2>
          <p className="text-xs text-mute">{dayLabel(today)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2 rounded-control border border-home/15 bg-white/80 px-3 py-2">
            <span className="text-sm">{BED_LABEL}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="quiet"
                aria-label={BED_EARLIER}
                onClick={() => {
                  setDirty(true);
                  setBedMin((b) => wrap(b - STEP_MIN));
                }}
              >
                −15
              </Button>
              <ClockTap
                text={bed}
                label="Type the bed time"
                testId="sleep-bed"
                onPick={(clock) => {
                  // A typed bed time keeps the wake time as it is, so the night's length follows.
                  const wakeClock = wakeClockOf(bedMin, lengthMin);
                  const nextBed = wrap(clock - 720);
                  setDirty(true);
                  setBedMin(nextBed);
                  setLengthMin(clamp(wrap(wakeClock - 720 - nextBed)));
                }}
              />
              <Button
                variant="quiet"
                aria-label={BED_LATER}
                onClick={() => {
                  setDirty(true);
                  setBedMin((b) => wrap(b + STEP_MIN));
                }}
              >
                +15
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-control border border-home/15 bg-white/80 px-3 py-2">
            <span className="text-sm">{WAKE_LABEL}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="quiet"
                aria-label={WAKE_EARLIER}
                onClick={() => {
                  setDirty(true);
                  setLengthMin((l) => clamp(l - STEP_MIN));
                }}
              >
                −15
              </Button>
              <ClockTap
                text={wake}
                label="Type the wake time"
                testId="sleep-wake"
                onPick={(clock) => {
                  setDirty(true);
                  setLengthMin(clamp(wrap(clock - 720 - bedMin)));
                }}
              />
              <Button
                variant="quiet"
                aria-label={WAKE_LATER}
                onClick={() => {
                  setDirty(true);
                  setLengthMin((l) => clamp(l + STEP_MIN));
                }}
              >
                +15
              </Button>
            </div>
          </div>
        </div>
        <p className="text-sm" data-testid="sleep-length">
          {nights === undefined ? LOADING : hm(lengthMin)}
        </p>

        {fail && (
          <Notice tone="danger" role="alert" data-testid="sleep-error" className="px-4 py-3 text-sm">
            {fail}
          </Notice>
        )}
        <Button onClick={save} disabled={saving || unchanged || nights === undefined} data-testid="sleep-save">
          {unchanged ? SAVED : saving ? "Saving…" : SAVE}
        </Button>
        {tonight === undefined && nights !== undefined && <p className="text-xs text-mute">{NOT_LOGGED}</p>}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">{WEEK_TITLE}</h2>
        <div className="mt-3 flex items-stretch justify-between gap-2" data-testid="sleep-week">
          {week.map((day) => {
            const row = nights?.find((n) => n.day === day);
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="relative h-24 w-full rounded-control bg-home/5"
                  title={row ? `${clockText(bedMinToClock(row.bedMin))} to ${clockText(wakeClockOf(row.bedMin, row.lengthMin))}` : NOT_LOGGED}
                >
                  {row ? (
                    nightBars(row.bedMin, row.lengthMin).map((bar, i) => (
                      <span key={i} className="absolute inset-x-1 rounded-control bg-home/40" style={{ top: `${bar.top}%`, height: `${bar.height}%` }} />
                    ))
                  ) : (
                    <span className="absolute bottom-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-home/30" />
                  )}
                </div>
                <span className="text-xs text-mute">{new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-mute">{TRACK_NOTE}</p>
      </Card>

      <Card className="space-y-2">
        <div className="flex flex-wrap gap-6">
          <div>
            <h3 className="text-xs text-mute">{USUAL_BEDTIME}</h3>
            <p className="text-lg font-medium tabular-nums" data-testid="sleep-usual">
              {usual === null ? FEW_NIGHTS : clockText(bedMinToClock(usual))}
            </p>
          </div>
          <div>
            <h3 className="text-xs text-mute">{AVERAGE_LENGTH}</h3>
            <p className="text-lg font-medium tabular-nums" data-testid="sleep-average">
              {average === null ? FEW_NIGHTS : hm(average)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
