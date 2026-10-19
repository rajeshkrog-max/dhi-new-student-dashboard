import { Card } from "@/components/dhi/ui/card";
import { BrandMark } from "@/components/dhi/ui/brand-mark";
import { DoorScene, doorCardClass } from "@/components/dhi/ui/door";
import { HouseFrame } from "@/components/dhi/ui/house-frame";
import { LoadingStatus, SlowWait, Skeleton } from "@/components/dhi/ui/skeleton";
import { TopBar } from "@/components/dhi/ui/top-bar";

// The two full screen waits (spec house/0003, AC-5). Both are neutral: they show no student name, class or data, because nothing is known yet.

// The dashboard while sign in is checked. It draws the real frame (top bar below 1024 px, side menu from 1024 px) with the rooms as plain blocks,
// because which rooms are locked is not known yet, and then a header, the greeting card and a row of cards.
export function DashboardSkeleton() {
  return (
    <>
      <HouseFrame
        testId="entry-waiting"
        topBar={<TopBar belowLargeOnly start={<Skeleton className="size-11 rounded-control" />} end={<Skeleton className="size-11 rounded-control" />} />}
        side={
          <>
            <BrandMark size="menu" className="mb-6 px-2" />
            <div className="flex min-h-0 flex-1 flex-col gap-0.5">
              {/* The house has 12 menu items; their names are not drawn because the exam lock is not known yet. */}
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="h-10 rounded-control" />
              ))}
            </div>
            <Skeleton className="mt-3 h-[4.5rem] rounded-control" />
          </>
        }
      >
        <LoadingStatus />
        <Skeleton className="h-14 shrink-0 rounded-control sm:h-9" />
        <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-3">
          <div className="min-w-0 space-y-2 max-sm:w-full">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="ml-auto hidden h-11 w-56 rounded-full md:block" />
        </div>
        <Card className="min-h-[7.75rem] shrink-0 px-6 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-56 max-w-full" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[6.6rem] rounded-card" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </HouseFrame>
      <SlowWait />
    </>
  );
}

// The front door while sign in is checked. The night poster (not the video) with a card the size of the Enter card, and no top bar.
export function DoorSkeleton() {
  return (
    <>
      <div data-testid="entry-waiting">
        <DoorScene media={<img src="/landing/night.png" alt="" className="absolute inset-0 size-full object-cover object-[20%_40%]" />}>
          <section className={doorCardClass(false, "min-h-[15rem]")}>
            <LoadingStatus />
            <Skeleton className="h-10 w-28 bg-white/15" />
            <Skeleton className="mt-2.5 h-4 w-64 max-w-full bg-white/15" />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Skeleton className="h-11 rounded-full bg-white/15" />
              <Skeleton className="h-11 rounded-full bg-white/15" />
            </div>
            <Skeleton className="mt-5 h-11 rounded-full bg-white/15" />
          </section>
        </DoorScene>
      </div>
      <SlowWait />
    </>
  );
}
