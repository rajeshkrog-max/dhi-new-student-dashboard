// The words of the staff houses (house spec 0026): the staff home, the DHI admin's overview, the counselor roster and a teacher's page for one
// student. Drafts until the owner approves them: the screens say so while STAFF_WORDS_APPROVED is false. A count is never a judgement of a person.
// Approved by the owner on 2026-10-28 ("approve all the words gates"). A change of the words after this is the owner's to approve again.
export const STAFF_WORDS_APPROVED = true;

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const STAFF_WORDS = {
  draft: "These words are drafts and may change.",
  loading: "Loading…",
  // The home
  homeTitle: "Home",
  homeIntro: "What is waiting for you. Each count opens its page.",
  nothing: "Nothing is waiting.",
  open: "Open",
  teacher: {
    toMark: (c: number) => n(c, "sitting to mark", "sittings to mark"),
    toConfirm: (c: number) => n(c, "mark to confirm for the student", "marks to confirm for the students"),
    postsToReview: (c: number) => n(c, "blog post to review", "blog posts to review"),
    commentsToReview: (c: number) => n(c, "comment to review", "comments to review"),
    closingSoon: (c: number) => n(c, "paper closes in the next two days", "papers close in the next two days"),
  },
  admin: {
    parentWaiting: (c: number) => n(c, "student under 18 waits for the parent's consent on file", "students under 18 wait for the parent's consent on file"),
    invitesPending: (c: number) => n(c, "invite not yet claimed", "invites not yet claimed"),
    invitesExpiring: (c: number) => n(c, "invite ends in the next three days", "invites end in the next three days"),
    classesPaused: (c: number) => n(c, "class has its logins paused", "classes have their logins paused"),
  },
  dhi: {
    filmsWaiting: (c: number) => n(c, "film waits for approval", "films wait for approval"),
    dishesWaiting: (c: number) => n(c, "dish waits to be published", "dishes wait to be published"),
    deskToday: (c: number) => `${n(c, "desk question", "desk questions")} reached the model today`,
    institutesPaused: (c: number) => n(c, "institute is paused", "institutes are paused"),
    counselorInvitesPending: (c: number) => n(c, "counselor invite not yet claimed", "counselor invites not yet claimed"),
    institutesWithoutAdmin: (c: number) =>
      `${n(c, "institute has", "institutes have")} students but no institute admin. Only an institute admin records a parent's consent, so students under 18 there cannot enter yet`,
  },
  // The DHI admin's overview
  overviewTitle: "Institutes at a glance",
  overviewIntro: "Counts only, for each institute. No names, and nothing from a student's rooms.",
  cols: { name: "Institute", status: "Status", classes: "Classes", students: "Students", staff: "Staff", invites: "Invites waiting", papers: "Papers this month", desk: "Desk questions this month" },
  status: { active: "Active", suspended: "Paused", removed: "Paused" } as Record<string, string>,
  // The counselor roster
  counselorsTitle: "Counselors",
  counselorsIntro: "Invite, pause and bring back counselors. You see how many times each has open, never their sessions or students.",
  openTimes: (c: number) => n(c, "time open", "times open"),
  noCounselors: "No counselors yet. Invite one below.",
  inviteTitle: "Invite a counselor",
  name: "Name",
  email: "Google email",
  invite: "Invite",
  invited: (name: string) => `${name} is invited.`,
  pendingTitle: "Invites not yet claimed",
  ends: (date: string) => `ends ${date}`,
  revoke: "Take back",
  pause: "Pause",
  bringBack: "Bring back",
  paused: (name: string) => `${name} is paused.`,
  back: (name: string) => `${name} is back.`,
  // A teacher's page for one student
  studentTitle: (name: string) => `Papers of ${name}`,
  close: "Close",
  studentLook: "Opening this page leaves a record the student sees in Your data. Answers are never shown here.",
  noPapers: "No papers were sent to this student yet.",
  due: (date: string) => `Due ${date}`,
  mark: (total: number, max: number) => `${total} of ${max}`,
  state: { missed: "Missed", excused: "Excused (the class was paused)", waiting: "Not marked yet" } as Record<string, string>,
};
