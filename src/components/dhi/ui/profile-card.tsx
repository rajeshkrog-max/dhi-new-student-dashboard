import { useStudent } from "@/lib/dhi/student";
import { cn } from "@/lib/utils";

// The student's initials, name and class. Shown at the foot of the side menu and the drawer.
export function ProfileCard({ className }: { className?: string }) {
  const student = useStudent();
  return (
    <div className={cn("flex items-center gap-3 rounded-control bg-white/55 p-3", className)}>
      <div data-decorative className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac text-sm font-semibold text-white">
        {student.initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{student.name}</p>
        <p className="text-xs text-mute">{student.house}</p>
      </div>
    </div>
  );
}
