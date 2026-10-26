// A calm page for a room that is not open yet (the DHI desk until a model is chosen, spec house/0016). It says what is coming in plain words,
// with a simple vector drawing. It takes no data and makes no calls.
import { Card } from "@/components/dhi/ui/card";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center" data-testid="coming-soon">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" className="text-home/70">
        <circle cx="60" cy="60" r="56" fill="currentColor" opacity="0.08" />
        <path d="M30 80 Q60 40 90 80" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="52" r="10" fill="currentColor" opacity="0.5" />
        <path d="M40 92 H80" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      </svg>
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="max-w-sm text-sm text-mute">{text}</p>
      <p className="text-xs text-mute">Coming soon.</p>
    </Card>
  );
}
