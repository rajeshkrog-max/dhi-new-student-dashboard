// The database tables: students, consent, checks and answers (spec 0002), leads and feedback (spec 0003), the
// queue that copies them to the team's Google Sheet (spec 0004) and the saved results (spec 0005).
// Every invariant below is checked in code inside the mutations (Convex has no database constraints), and
// uniqueness holds only because those mutations look rows up by index. Later slices add tables that point at
// `students` and `checks` by id, so nothing here changes. Nothing may be renamed or removed in the same release
// as the code that stops using it (spec 0001, deploys and environments).
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const classValidator = v.union(
  v.literal("Class 8"),
  v.literal("Class 9"),
  v.literal("Class 10"),
  v.literal("Class 11"),
  v.literal("Class 12"),
  v.literal("College"),
);

// The house (spec house/0002): five roles. A person has one role for life; roles never change after an account is made.
export const roleValidator = v.union(
  v.literal("student"),
  v.literal("teacher"),
  v.literal("institute_admin"),
  v.literal("dhi_admin"),
  v.literal("counselor"),
);

// Every kind of change to access, as a fixed code. The access log holds only these, with ids (spec house/0002, AC-12).
export const accessActionValidator = v.union(
  v.literal("invite.create"),
  v.literal("invite.claim"),
  v.literal("invite.revoke"),
  v.literal("invite.extend"),
  v.literal("invite.update"),
  v.literal("member.remove"),
  v.literal("member.reinstate"),
  v.literal("member.class"),
  v.literal("member.under18"),
  v.literal("member.move"),
  v.literal("class.create"),
  v.literal("class.archive"),
  v.literal("class.pause"),
  v.literal("class.resume"),
  v.literal("class.assign"),
  v.literal("class.unassign"),
  v.literal("inst.create"),
  v.literal("inst.suspend"),
  v.literal("inst.reinstate"),
  // Consent, sharing, erase and class totals (spec house/0005).
  v.literal("consent.parent"),
  v.literal("consent.parentWithdrawn"),
  v.literal("consent.parentRestored"),
  v.literal("sharing.set"),
  // The private weekly page link for a parent (spec house/0022): made or renewed, and removed (by the student, or when sharing is turned off).
  v.literal("sharing.link"),
  v.literal("sharing.unlink"),
  v.literal("data.erase"),
  v.literal("totals.read"),
  // A school report opened for one class (house spec 0025): class totals of papers; the named support list also writes view rows.
  v.literal("school.report"),
);

export const styleKeyValidator = v.union(v.literal("v"), v.literal("p"), v.literal("k"));
export const confidenceValidator = v.union(v.literal("clear"), v.literal("leaning"), v.literal("blended"));

// What the public leaderboard shows for one student (spec 0018, AC-2). Built only by `rowFor` in challengeBoard.ts.
export const boardRowValidator = v.object({
  rank: v.number(),
  displayName: v.string(), // first name and last initial, or "Anonymous <Style>"
  cls: v.optional(v.string()), // omitted when the name is hidden
  style: v.string(), // Builder, Achiever or Explorer
  valid: v.number(),
  avatar: v.optional(v.string()),
});

export default defineSchema({
  // One row per Google account. Personal data of minors: never returned by a public function except through `me`.
  students: defineTable({
    authUserId: v.string(), // the Better Auth user id
    email: v.string(), // lowercase copy of the Google email
    name: v.string(),
    age: v.number(),
    class: classValidator,
    referralCodeEntered: v.optional(v.string()),
    pictureNoticeDeclinedAt: v.optional(v.number()), // when the student tapped Not now on the picture notice (spec 0011); asked again after 14 days
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

  // The exact consent text of each version. Added the first time a version is used, never edited.
  consentTexts: defineTable({
    version: v.string(),
    hash: v.string(),
    text: v.string(),
  }).index("by_version", ["version"]),

  // Only ever added to. The audit trail for what a student (and a guardian) agreed to.
  consents: defineTable({
    studentId: v.id("students"),
    kind: v.union(v.literal("landing"), v.literal("lead"), v.literal("share"), v.literal("challenge")),
    textVersion: v.string(),
    ageAtConsent: v.number(),
    guardianPresent: v.boolean(),
    acceptedAt: v.number(),
  }).index("by_studentId", ["studentId"]),

  // At most one per student in this spec. The start time is the row's _creationTime.
  checks: defineTable({
    studentId: v.id("students"),
    seed: v.string(), // made on the server, used for the per student option shuffle
    source: v.union(v.literal("fresh"), v.literal("imported")),
    completedAt: v.optional(v.number()),
    reportSeenAt: v.optional(v.number()),
  }).index("by_studentId", ["studentId"]),

  // One row per (checkId, q), changed in place until the check is complete.
  answers: defineTable({
    checkId: v.id("checks"),
    q: v.number(),
    optionId: v.string(),
    answeredAt: v.number(),
  }).index("by_checkId_and_q", ["checkId", "q"]),

  // The scored result of a finished check (spec 0005). One per check, written once at Finish and never edited or
  // deleted by any function. `detail` is made by the server from fixed code (never from user input) and holds no flags.
  results: defineTable({
    checkId: v.id("checks"),
    studentId: v.id("students"),
    engineVersion: v.number(), // DhiScore.ENGINE_VERSION when it was scored
    scoredAt: v.number(),
    dhiStart: v.number(), // 0 to 100
    styleKey: styleKeyValidator,
    confidence: confidenceValidator,
    detail: v.any(), // areas, state, style percents, styleGap, top, bottom, lowest, indices, subject
  })
    .index("by_checkId", ["checkId"])
    .index("by_studentId", ["studentId"]), // by_studentId is for erasing a student's data (scope row 15)

  // The sensitive flags of a result, kept apart so a normal read of `results` can never hand one out (spec 0005).
  // One per result, never edited. Only the owner's `results.mine` and `results.ensure` return them.
  resultFlags: defineTable({
    resultId: v.id("results"),
    studentId: v.id("students"),
    keepsFeelingsInside: v.boolean(),
    lowCareerClarity: v.boolean(),
    heavyExpectations: v.boolean(),
    selfDoubt: v.boolean(),
    sleepStrain: v.boolean(),
    lowMood: v.boolean(),
    lowConsistency: v.boolean(),
  })
    .index("by_resultId", ["resultId"])
    .index("by_studentId", ["studentId"]), // for erasing a student's data (scope row 15)

  // What a student gave on the phone step (spec 0003). One per check, the first one kept. Never returned to a browser.
  leads: defineTable({
    studentId: v.id("students"),
    checkId: v.id("checks"),
    phone: v.string(), // 10 digits, first digit 6 to 9
    wantsCommunity: v.boolean(),
    whatsappOptInAt: v.optional(v.number()), // set only when wantsCommunity is true
    whatsappStatus: v.optional(v.union(v.literal("new"), v.literal("added"), v.literal("opted_out"))), // same rule; changed by hand
    phoneSeenBefore: v.boolean(),
    consentId: v.id("consents"),
  })
    .index("by_checkId", ["checkId"])
    .index("by_phone", ["phone"]),

  // The report feedback (spec 0003). One per check, the first one kept. Never returned to a browser.
  feedback: defineTable({
    studentId: v.id("students"),
    checkId: v.id("checks"),
    rating: v.number(), // 1 to 5
    text: v.string(),
    chars: v.number(),
    genuine: v.boolean(),
    genuineAt: v.optional(v.number()), // when the note became genuine (spec 0016): set at save for a genuine note; read by the challenge job
    canShare: v.boolean(),
  }).index("by_checkId", ["checkId"]),

  // The copy queue (spec 0004): one row per (kind, refId). `key` is the Sheet's reference code, stored so a delete
  // still works after the source row is gone. `lastError` is a short Google reason, never record content.
  sheetSync: defineTable({
    kind: v.union(v.literal("lead"), v.literal("feedback")),
    refId: v.string(),
    key: v.string(),
    op: v.union(v.literal("upsert"), v.literal("delete")),
    status: v.union(v.literal("pending"), v.literal("sending"), v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    rowHash: v.optional(v.string()), // fingerprint of the last row sent
  })
    .index("by_kind_and_refId", ["kind", "refId"])
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"]),

  // The saved PDF copy of a student's report (spec 0006). One row per check, made by the server only (Cloudflare Browser
  // Run draws our own render page); nothing is ever uploaded from a browser. `storageId` is never given to a browser:
  // the owner downloads through GET /api/files/report. `lastError` is a short code, never student data.
  reportFiles: defineTable({
    studentId: v.id("students"),
    checkId: v.id("checks"),
    resultId: v.id("results"),
    state: v.union(v.literal("queued"), v.literal("making"), v.literal("ready"), v.literal("failed")), // the latest job
    wantedVersion: v.number(),
    storageId: v.optional(v.id("_storage")), // the copy held (can exist while a newer one is made)
    size: v.optional(v.number()),
    sha256: v.optional(v.string()),
    reportVersion: v.optional(v.number()), // the version of the held copy
    attempts: v.number(), // counted tries in this round
    nextAttemptAt: v.optional(v.number()),
    leaseUntil: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    readyAt: v.optional(v.number()),
    replacedAt: v.optional(v.number()),
  })
    .index("by_checkId", ["checkId"])
    .index("by_studentId", ["studentId"]) // for erasing a student's data (scope row 15)
    .index("by_storageId", ["storageId"])
    .index("by_state_and_nextAttemptAt", ["state", "nextAttemptAt"])
    .index("by_readyAt", ["readyAt"]), // the team list, newest copy first (spec 0008)

  // One row for every PDF the team route served (spec 0008). Only ever added to: no app code edits or deletes a row, and
  // only the erasure of a student (scope row 15) may delete them. Ids, a fingerprint and a team email only; no student data.
  reportViews: defineTable({
    studentId: v.id("students"), // whose report was opened
    reportFileId: v.id("reportFiles"),
    sha256: v.string(), // the fingerprint of the exact file that was served
    reportVersion: v.number(),
    teamEmail: v.string(), // lowercase, from the signed in account
    viewedAt: v.number(),
  })
    .index("by_studentId", ["studentId"])
    .index("by_teamEmail_and_viewedAt", ["teamEmail", "viewedAt"]),

  // The student's Google profile picture, copied once into our own storage (spec 0011). One row per student, patched in place.
  // `sourceUrl`, `storageId` and `etag` are never given to a browser: a browser gets only `/api/avatar/<key>`. `key` is random and
  // made again whenever the image changes, so an old address stops working. `lastError` is a short code, never a URL or a name.
  avatars: defineTable({
    studentId: v.id("students"),
    key: v.string(), // 22 chars, base64url
    storageId: v.optional(v.id("_storage")), // absent after a removal, or when Google has no photo
    contentType: v.optional(v.string()), // image/jpeg, image/png or image/webp, taken from the file's own first bytes
    size: v.optional(v.number()),
    sha256: v.optional(v.string()), // tells a changed image from the same one
    sourceUrl: v.string(), // the Google address last used (host checked)
    etag: v.optional(v.string()),
    checkedAt: v.number(), // the last time it was compared with Google (0 until the first fetch lands)
    updatedAt: v.number(), // when the image last changed
    removedAt: v.optional(v.number()), // set by the student's Remove
    blockedAt: v.optional(v.number()), // set by the team; cleared only by the team
    leaseUntil: v.optional(v.number()), // one fetch at a time for a student
    leaseToken: v.optional(v.string()), // checked when the fetch lands
    lastError: v.optional(v.string()),
  })
    .index("by_studentId", ["studentId"])
    .index("by_key", ["key"])
    .index("by_storageId", ["storageId"]),

  // The private link to a student's report (spec 0010). One row per student, patched in place; the link code is made from `_id` and
  // `generation` and signed with SHARE_LINK_SECRET, so nothing secret is stored here. A new link is a new generation, and the old
  // code stops working. Deleting the row ends the link at once (the erase request, scope row 15, must delete it).
  reportShares: defineTable({
    studentId: v.id("students"),
    checkId: v.id("checks"),
    generation: v.number(), // starts at 1; +1 each time a new link is made
    consentId: v.optional(v.id("consents")), // the share consent this generation was made under; set from M2 on (spec 0010 says required, see shares.ts)
    createdAt: v.number(), // when this generation started
    expiresAt: v.number(), // min(last Share tap + 90 days, createdAt + 365 days)
    offAt: v.optional(v.number()), // set by Stop sharing or by the team
  }).index("by_studentId", ["studentId"]), // at most one row per student; also for erasing a student's data (scope row 15)

  // A student who joined the Founding Circle Challenge (spec 0015, children 0016 and 0017). One row per student; a leave deletes it (M2) and
  // the `challenge` consent row stays. `code` is the referral code. `validCount` and `lastValidAt` are written only by the job and the team
  // commands, always through `recount` in challengeCore.ts. `rank`, `toNext` and `nextRank` are written by the job (spec 0018, M3).
  challengeEntries: defineTable({
    studentId: v.id("students"),
    code: v.string(), // 7 chars, CODE_RE
    joinedAt: v.number(),
    consentId: v.id("consents"), // the `challenge` consent row made at join
    hideName: v.boolean(),
    validCount: v.number(),
    lastValidAt: v.optional(v.number()),
    rank: v.optional(v.number()),
    toNext: v.optional(v.number()),
    nextRank: v.optional(v.number()),
  })
    .index("by_studentId", ["studentId"])
    .index("by_code", ["code"])
    .index("by_validCount", ["validCount"]) // the job ranks every entry above 0 (spec 0018); spec 0022's Challenge tab reads it too
    .index("by_rank", ["rank"]), // entries that hold a rank: the job clears stale ones, and a removal after the freeze moves those below up

  // The public leaderboard (spec 0018). One row, written only by the 5 minute job (and the one row removal after the freeze). A row holds
  // exactly these keys and no id, email, phone, age, flag or last name; `convex/challenge.test.ts` scans them. `avatar` is a same origin
  // picture path, only while LEADERBOARD_PICTURES_ENABLED is on and the student did not hide their name.
  leaderboardSnapshots: defineTable({
    rows: v.array(boardRowValidator),
    computedAt: v.number(),
    frozen: v.boolean(), // true after the final run at the deadline; later runs change nothing
  }),

  // One row per friend who signed up with a referrer's code (spec 0016). Made by `students.createProfile`; settled by the 5 minute job
  // from the friend's own step times (`checks.completedAt`, `checks.reportSeenAt`, `feedback.genuineAt`). Never written by a browser call.
  referrals: defineTable({
    referrerId: v.id("students"),
    friendId: v.id("students"),
    code: v.string(),
    usedAt: v.number(),
    status: v.union(v.literal("pending"), v.literal("valid"), v.literal("rejected")),
    validAt: v.optional(v.number()), // the latest of the three step times, when the referral became valid
    rejectReason: v.optional(v.union(v.literal("deadline"), v.literal("review"))),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_friendId", ["friendId"]) // at most one referral per friend, kept by createProfile looking here first
    .index("by_referrerId_and_status", ["referrerId", "status"])
    .index("by_status", ["status"]),

  // ---- The house (spec house/0002). All tables are additive; the funnel's tables above are not touched. Uniqueness and tenancy hold only
  // because every mutation looks rows up by index first. Erase classes (spec 0001 child 0002, funnel spec 0023): `institutes` and `classes`
  // are `kept` (no person in them); `members`, `teacherClasses` and `invites` are `erased` or `patched` per row 4's rules; `accessLog` is
  // `kept` and holds ids and codes only.

  // A school or college. Created by a DHI admin only.
  institutes: defineTable({
    name: v.string(),
    nameKey: v.string(), // lowercase and trimmed, for the duplicate check
    status: v.union(v.literal("active"), v.literal("suspended")),
    plan: v.optional(v.string()),
  }).index("by_nameKey", ["nameKey"]),

  // A grade and section of one institute. Archived, never deleted, while members point at it.
  classes: defineTable({
    instituteId: v.id("institutes"),
    grade: classValidator,
    section: v.string(),
    archivedAt: v.optional(v.number()),
    pausedAt: v.optional(v.number()), // logins of the class's students are paused from this moment (spec house/0021); resume clears it
  })
    .index("by_instituteId", ["instituteId"])
    .index("by_instituteId_and_grade", ["instituteId", "grade"]),

  // Each time a class's logins were paused (spec house/0021): when it began and, once resumed, when it ended. `classes.pausedAt` stays the answer to "is it
  // paused now"; this is the answer to "was it paused then", for the Brain's real zeros and the exams' excused windows. No person in it.
  classPauses: defineTable({
    classId: v.id("classes"),
    instituteId: v.id("institutes"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  }).index("by_classId_and_startedAt", ["classId", "startedAt"]),

  // One row per person in the house. Identity is always `authUserId`, never `email` (a snapshot only). Shape rules are checked in code on
  // every write: student, teacher and institute_admin have an instituteId; dhi_admin and counselor do not; only a student has classId and under18.
  members: defineTable({
    authUserId: v.string(), // the Better Auth user id, shared with the funnel's `students` row if there is one
    role: roleValidator,
    instituteId: v.optional(v.id("institutes")),
    classId: v.optional(v.id("classes")),
    name: v.string(),
    email: v.string(),
    under18: v.optional(v.boolean()),
    status: v.union(v.literal("active"), v.literal("removed")),
    joinedAt: v.number(),
    removedAt: v.optional(v.number()),
    // Set when the person is erased (spec house/0005, AC-13). The row stays as a tombstone: name and email empty, `authUserId` replaced by
    // `erased:<id>`, and the role, institute, class and under18 flag kept as the proof of what consent applied. It is locked and invisible at once.
    erasedAt: v.optional(v.number()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_instituteId_and_role", ["instituteId", "role"])
    .index("by_classId", ["classId"])
    .index("by_status_and_removedAt", ["status", "removedAt"]), // the daily sweep of members removed for 12 months (spec house/0005, AC-15)

  // Which classes a teacher is assigned to.
  teacherClasses: defineTable({
    memberId: v.id("members"),
    classId: v.id("classes"),
    instituteId: v.id("institutes"),
  })
    .index("by_memberId", ["memberId"])
    .index("by_classId", ["classId"])
    .index("by_memberId_and_classId", ["memberId", "classId"]),

  // An invitation: the Google email is the key, there is no secret code. Pending means not claimed and not revoked, expired or not.
  invites: defineTable({
    instituteId: v.optional(v.id("institutes")),
    role: roleValidator,
    email: v.string(),
    name: v.string(),
    classId: v.optional(v.id("classes")),
    under18: v.optional(v.boolean()),
    createdBy: v.union(v.id("members"), v.literal("owner")),
    expiresAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.id("members")),
    revokedAt: v.optional(v.number()),
  })
    .index("by_email_and_claimedAt", ["email", "claimedAt"])
    .index("by_email_and_claimedAt_and_revokedAt", ["email", "claimedAt", "revokedAt"]) // the one pending invite of an address, however many were revoked before it
    .index("by_instituteId", ["instituteId"])
    .index("by_classId", ["classId"]),

  // Only ever added to. Ids and a code from the fixed list, never a name, an email or a note (AC-12).
  accessLog: defineTable({
    at: v.number(),
    actor: v.union(v.id("members"), v.literal("owner")),
    action: accessActionValidator,
    instituteId: v.optional(v.id("institutes")),
    targetMemberId: v.optional(v.id("members")),
    inviteId: v.optional(v.id("invites")),
  })
    .index("by_instituteId_and_at", ["instituteId", "at"])
    .index("by_actor_and_at", ["actor", "at"]), // a staff member's own actions, for their download (dataRights.exportStaffMine)

  // What a student and their school agreed to, and every withdrawal (spec house/0005). Append only: no app code changes a row, and none deletes one
  // (the erase of a student keeps them as the proof of what consent applied). Erase class `kept`. Holds ids, codes and a wording version only:
  // never a parent's name, phone or form. `kind`: `self` is the student pressing I agree; `parent` is the school recording that a parent's consent
  // is on file; `withdrawn` and `restored` move one side (`by`) off and on. The order of rows is their creation order.
  consentRecords: defineTable({
    memberId: v.id("members"),
    instituteId: v.optional(v.id("institutes")),
    kind: v.union(v.literal("self"), v.literal("parent"), v.literal("withdrawn"), v.literal("restored")),
    by: v.union(v.literal("self"), v.literal("school")),
    byMemberId: v.id("members"), // the student for `self`, the institute admin for `school`
    textVersion: v.string(), // the wording version for `self` and `parent`; the version in force for a withdrawal or a restore
    under18AtTime: v.boolean(), // the flag when the row was made; a missing flag counts as under 18
  })
    .index("by_memberId_and_kind", ["memberId", "kind"])
    .index("by_memberId_and_by", ["memberId", "by"]),

  // The student's own choice of what a parent may see (spec house/0005, AC-9). Erase class `erased`. No row means `none`. No parent account exists.
  sharingSettings: defineTable({
    memberId: v.id("members"),
    parentLevel: v.union(v.literal("none"), v.literal("summary")),
    at: v.number(),
  }).index("by_memberId", ["memberId"]),

  // The one private link a student gives their parent (spec house/0022). Erase class `erased`. Holds a SHA 256 of the secret code, never the code,
  // so the code is shown to the student once and cannot be read back. At most one row for a student: making a new link replaces the old one, turning
  // sharing off or removing the link deletes it. `lastLoggedAt` keeps the student's "who has looked" record to one row an hour for a refreshing page.
  // A student's own tap linking their house account to their DhiRise funnel check (spec house/0002 follow up). A date and nothing from the check. At most
  // one row for a student; unlinking or erasing deletes it. The funnel's own rows are never touched.
  funnelLinks: defineTable({
    memberId: v.id("members"),
    instituteId: v.optional(v.id("institutes")),
    linkedAt: v.number(),
  }).index("by_memberId", ["memberId"]),

  parentLinks: defineTable({
    memberId: v.id("members"),
    instituteId: v.optional(v.id("institutes")),
    codeHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastLoggedAt: v.optional(v.number()),
  })
    .index("by_memberId", ["memberId"])
    .index("by_codeHash", ["codeHash"])
    .index("by_expiresAt", ["expiresAt"]),

  // One row each time staff looked at a student's named personal data (spec house/0005, AC-10). Ids and codes only, never a name. Erase class
  // `kept` for 3 years, then deleted by the daily sweep. `viewerId` is absent for the DHI team. Never changed.
  viewLog: defineTable({
    viewerId: v.optional(v.id("members")),
    viewerRole: v.union(roleValidator, v.literal("team"), v.literal("parent")), // `parent` is a look through the student's own weekly link (spec house/0022)
    targetMemberId: v.id("members"),
    instituteId: v.optional(v.id("institutes")),
    kind: v.string(), // a data kind code (accessRules.ts)
    at: v.number(),
  })
    .index("by_targetMemberId_and_at", ["targetMemberId", "at"])
    .index("by_at", ["at"]),

  // The receipt of an erase (spec house/0005, AC-13, AC-19): counts of rows deleted, never a student id, name or email. Erase class `kept`. Readable
  // by internal code only.
  houseErasures: defineTable({
    at: v.number(),
    by: v.union(v.literal("self"), v.literal("team"), v.literal("retention")),
    counts: v.record(v.string(), v.number()),
  }),

  // The 30 day block on a student's own erase (spec house/0005, AC-13): a keyed hash of the lowercase email, never the email. Class `system`.
  houseErasedEmails: defineTable({
    hash: v.string(),
    until: v.number(),
  })
    .index("by_hash", ["hash"])
    .index("by_until", ["until"]),

  // The mood room (spec house/0006). One row for each student and day, holding the mood, the student's own few words and which of two DHI lines the
  // day got. Erase class `erased`. Seen by the student alone: no function reads it for anyone else, and the event the room writes holds only the
  // mood code. Uniqueness of (memberId, day) holds only because `moods.save` looks it up first.
  moodDays: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    day: v.string(), // YYYY-MM-DD, the 04:00 to 04:00 India day (dayRules.ts)
    mood: v.string(), // a code from MOOD_CODES (moodRules.ts)
    note: v.optional(v.string()), // at most 500 code points; absent when empty
    lineIx: v.number(), // 0 or 1: which of the two DHI lines this day got, set on the first save
    changes: v.number(), // how many times the mood changed (the first save is 0)
    noteEdits: v.optional(v.number()), // how many note edits changed the word count and so wrote an event (the key counter of those events)
  }).index("by_memberId_and_day", ["memberId", "day"]),

  // The papers room (spec house/0011). A teacher's paper: its questions (the right answers and the wrong option tags stay here and never reach a
  // student), its sends (a class or one student, with an open and a due time), and one attempt row a student has per paper, made at send time.
  // Marks and remarks live on the attempt and show to the student only after the teacher confirms them.
  papers: defineTable({
    teacherMemberId: v.id("members"),
    instituteId: v.id("institutes"),
    title: v.string(),
    status: v.string(), // "draft" or "sent"
    createdAt: v.number(),
  }).index("by_teacherMemberId", ["teacherMemberId"]),

  paperQuestions: defineTable({
    paperId: v.id("papers"),
    order: v.number(),
    kind: v.string(), // "mcq" or "long"
    subject: v.string(),
    topic: v.string(),
    text: v.string(),
    options: v.optional(v.array(v.string())), // mcq only
    rightOption: v.optional(v.number()), // mcq only, server only
    tags: v.optional(v.array(v.union(v.string(), v.null()))), // mcq only: a wrong option's tag, null for the right one, server only
    maxMarks: v.optional(v.number()), // long only
    rubric: v.optional(v.string()), // long only
    hint: v.optional(v.string()), // the teacher's hint, server only until a student opens it in a sitting (exams.hint)
  }).index("by_paperId", ["paperId"]),

  paperSends: defineTable({
    paperId: v.id("papers"),
    instituteId: v.id("institutes"),
    target: v.string(), // "class" or "student"
    classId: v.optional(v.id("classes")),
    memberId: v.optional(v.id("members")),
    opensAt: v.number(),
    dueAt: v.number(),
    sentAt: v.number(),
  })
    .index("by_paperId", ["paperId"])
    // The school report finds the papers sent to one class by their due time (house spec 0025).
    .index("by_classId_and_dueAt", ["classId", "dueAt"]),

  // One row a student has for a paper, made when the paper is sent. Answers, marks and remarks belong to the student and are erased with them.
  paperAttempts: defineTable({
    paperId: v.id("papers"),
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    status: v.string(), // "assigned", "submitted", "marked" or "confirmed"
    opensAt: v.number(),
    dueAt: v.number(),
    marks: v.optional(v.array(v.object({ question: v.number(), mark: v.number() }))),
    answers: v.optional(v.array(v.object({ question: v.number(), choice: v.optional(v.number()), text: v.optional(v.string()) }))),
    hintsOpened: v.optional(v.array(v.number())), // the questions whose hint the student opened (the Brain's hint count)
    startedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    autoSubmitted: v.optional(v.boolean()), // true when the window closed before the student pressed Submit
    excused: v.optional(v.boolean()), // true when the window closed with nothing answered while the student's class had its logins paused: not a miss (spec house/0021)
    missed: v.optional(v.boolean()), // true when the window closed with nothing submitted (owner's rule: counts as a miss)
    mcqCorrect: v.optional(v.number()), // the multiple choice questions answered right, marked by the server at submission
    remarks: v.optional(v.string()),
    markedBy: v.optional(v.id("members")),
    markedAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()), // when the student accepted the teacher's feedback, set once (exams.acceptFeedback)
  })
    .index("by_memberId", ["memberId"])
    .index("by_paperId_and_memberId", ["paperId", "memberId"])
    .index("by_memberId_and_status", ["memberId", "status"]) // the exam lock (examLock.ts) finds an open sitting
    .index("by_status_and_dueAt", ["status", "dueAt"]),

  // The blog room (spec house/0014). A post is written by a student and stays pending until a teacher of the author's class approves it. Only an
  // approved post is read by classmates in the institute; the author always sees their own. The body is cleaned on the server (blogRules.ts)
  // before it is stored. Erase class `erased`: a post is the student's own writing.
  blogPosts: defineTable({
    authorMemberId: v.id("members"),
    instituteId: v.id("institutes"),
    title: v.string(),
    tag: v.string(), // a code from POST_TAGS (blogRules.ts)
    body: v.string(), // cleaned markup, bold, italic and a numbered list only
    photoId: v.optional(v.id("_storage")),
    status: v.string(), // "pending", "approved", "hidden" or "removed"
    reviewedBy: v.optional(v.id("members")),
    publishedAt: v.optional(v.number()), // the first approval, set once: the moment the Brain counts the post as published
    createdAt: v.number(),
  })
    .index("by_authorMemberId", ["authorMemberId"])
    .index("by_instituteId", ["instituteId"])
    // A teacher's pending list and a classmate's approved list (review of 2026-10-26), so many newer posts never hide an older one waiting.
    .index("by_instituteId_and_status", ["instituteId", "status"])
    .index("by_photoId", ["photoId"]),

  blogComments: defineTable({
    postId: v.id("blogPosts"),
    authorMemberId: v.id("members"),
    instituteId: v.id("institutes"),
    text: v.string(), // plain text, escaped; reviewed like a post
    status: v.string(), // "pending", "approved", "hidden" or "removed"
    reviewedBy: v.optional(v.id("members")),
    createdAt: v.number(),
    countedAt: v.optional(v.number()), // the first approval, set once: the moment the Brain counts the comment (written and received)
  })
    .index("by_postId", ["postId"])
    .index("by_authorMemberId", ["authorMemberId"])
    .index("by_instituteId_and_status", ["instituteId", "status"]),

  // The Brain's daily values (spec house/0019). One row for each student and house day that has any value: `values` maps a measure id (metricRules.ts)
  // to its top and bottom parts. A day with nothing to measure has no row, and a measure with nothing to measure is missing from `values`; neither is a
  // zero. Worked out from the events by brainRollup.ts, the only writer; rebuilt when `version` is older than METRIC_VERSION. Erase class `erased`.
  brainDays: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    day: v.string(), // YYYY-MM-DD, the 04:00 to 04:00 India day
    values: v.record(v.string(), v.object({ num: v.number(), den: v.number() })),
    version: v.number(),
    computedAt: v.number(),
  })
    .index("by_memberId_and_day", ["memberId", "day"])
    .index("by_version", ["version"]),

  // A pattern a student marked "does not feel true" is hidden for a while (spec house/0020). One row for each student and pattern. Erase class `erased`.
  brainHides: defineTable({
    memberId: v.id("members"),
    patternId: v.string(),
    until: v.number(),
  }).index("by_memberId_and_patternId", ["memberId", "patternId"]),

  // The rollup's own place: the moment it has read the events up to, and the counts of the last nightly check. No person in it.
  brainState: defineTable({
    key: v.string(),
    cursor: v.number(),
    capped: v.optional(v.boolean()), // the last pass stopped early, so the next one reads strictly after the cursor
    token: v.optional(v.string()), // where a paged job stopped (the rebuild of stale days), so rows it cannot rebuild do not hold up the rest
    checked: v.optional(v.number()),
    mismatches: v.optional(v.number()),
    at: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // The food table (spec house/0009). The catalog (status "catalog") is loaded only after its source licence is checked, so it starts empty. A
  // student's own custom dish (status "custom") holds the numbers the student gave, and counts for them at once. DHI can publish a custom dish,
  // which copies it into the catalog with the source "DHI checked". Numbers are per serving.
  foods: defineTable({
    status: v.string(), // "catalog", "custom", or "published" (a custom dish DHI copied into the catalog; the copy has no owner)
    nameEn: v.string(),
    nameHi: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    group: v.string(), // a code from FOOD_GROUPS (foodRules.ts)
    processing: v.string(), // a code from PROCESSING
    energyKcal: v.number(),
    carbsG: v.number(),
    proteinG: v.number(),
    fatG: v.number(),
    serving: v.string(),
    source: v.string(),
    licence: v.string(),
    ownerMemberId: v.optional(v.id("members")), // custom dishes only
    publishedBy: v.optional(v.id("members")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_ownerMemberId", ["ownerMemberId"]),

  // The meals room (spec house/0010). One row a plate a student logged: the food (catalog or the student's own dish), a count, the meal and the
  // house day of the time it was eaten. The event holds the meal and the group only, never the dish name.
  mealPlates: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    day: v.string(), // the house day of `eatenAt` (dayRules.ts)
    meal: v.string(), // a code from MEALS
    eatenAt: v.number(),
    foodId: v.id("foods"),
    group: v.string(),
    count: v.number(),
    removedAt: v.optional(v.number()),
  })
    .index("by_memberId_and_day", ["memberId", "day"])
    .index("by_memberId", ["memberId"]),

  // The modules room (spec house/0013). A film is uploaded and approved by DHI only; a student has no way to add one. `hostRef` is the video's
  // reference at the host (a path in the house's own public folder until the video host account is ready). Academic films carry two check
  // questions (`filmChecks`), whose right options stay on the server. Progress is written by the server only, and the score is written once.
  films: defineTable({
    title: v.string(),
    category: v.string(), // a code from CATEGORIES (moduleRules.ts)
    blurb: v.string(),
    cover: v.string(), // a path in the house's public folder
    hostRef: v.string(),
    durationSec: v.number(),
    scoreValue: v.number(),
    status: v.string(), // "pending" or "approved"
    uploadedBy: v.id("members"),
    approvedBy: v.optional(v.id("members")),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  filmChecks: defineTable({
    filmId: v.id("films"),
    order: v.number(),
    question: v.string(),
    options: v.array(v.string()),
    rightOption: v.number(), // server only
  }).index("by_filmId", ["filmId"]),

  // One row a student has for a film they started. `furthestSec` is raised only by the server, a little faster than real time at most.
  // `scored` is true once the score was written (at the end of the film); a replay writes nothing. Erase class `erased`.
  filmProgress: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    filmId: v.id("films"),
    furthestSec: v.number(),
    lastAt: v.optional(v.number()),
    scored: v.boolean(),
    scoredAt: v.optional(v.number()),
  })
    .index("by_memberId_and_filmId", ["memberId", "filmId"])
    .index("by_memberId", ["memberId"]),

  // The study hour (spec house/0015). A DHI admin sets the hour. A seat is a student's place in it: they enter only while it is open, and a seat
  // with no heartbeat for 60 seconds is dropped. Seats and chat belong to an institute, and a student sees only their own institute's. Presence
  // minutes go to the event log as a number when a seat ends. Erase class `erased` for seats and chat (they are the student's own).
  studyHours: defineTable({
    opensAt: v.number(),
    closesAt: v.number(),
    setBy: v.id("members"),
    createdAt: v.number(),
  }).index("by_opensAt", ["opensAt"]),

  seats: defineTable({
    hourId: v.id("studyHours"),
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    mode: v.string(), // "live", "away" or "dnd"
    enteredAt: v.number(),
    lastBeatAt: v.number(),
    leftAt: v.optional(v.number()),
    // The after session card (spec house/0018): "pending" when a stay of 20 minutes or more ends, then "answered" or "skipped". A skip changes no value.
    feedbackStatus: v.optional(v.string()),
    feel: v.optional(v.string()), // a code from FEELS (sessionRules.ts), only when answered
    focus: v.optional(v.number()), // 1 to 5, only when answered
  })
    .index("by_hourId_and_instituteId", ["hourId", "instituteId"])
    .index("by_memberId_and_hourId", ["memberId", "hourId"])
    .index("by_memberId", ["memberId"])
    .index("by_leftAt", ["leftAt"]),

  chatMessages: defineTable({
    hourId: v.id("studyHours"),
    instituteId: v.id("institutes"),
    authorMemberId: v.id("members"),
    text: v.string(),
    createdAt: v.number(),
    reported: v.boolean(),
    status: v.string(), // "shown" or "hidden"
  })
    .index("by_hourId_and_instituteId", ["hourId", "instituteId"])
    .index("by_authorMemberId", ["authorMemberId"])
    // The review screens (review of 2026-10-26): a teacher reads their own institute's newest messages, and a DHI admin the reported ones, so a busy
    // institute never pushes another out of view.
    .index("by_instituteId", ["instituteId"])
    .index("by_reported", ["reported"]),

  // The sleep room (spec house/0008). One row for each student and night, holding the bed time and the length of sleep, both as minutes on the
  // noon shifted scale (sleepRules.ts). Erase class `erased`. Seen by the student alone: no function reads it for anyone else, and the event the room
  // writes holds only the two numbers. Uniqueness of (memberId, day) holds only because `sleep.save` looks it up first.
  sleepNights: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    day: v.string(), // YYYY-MM-DD, the house day on which the night was saved (dayRules.ts)
    bedMin: v.number(), // 0 to 1439, a multiple of 15: minutes after 12:00 noon India time
    lengthMin: v.number(), // 60 to 960, a multiple of 15
    changes: v.number(), // how many times the night changed (the first save is 0)
  }).index("by_memberId_and_day", ["memberId", "day"]),

  // The habits room (spec house/0007). A habit has a kind (a fixed code or `custom`), the student's own title, a colour and a window. Erase class
  // `erased`. Seen by the student alone: no function reads it for anyone else, and the event a tick writes holds only the kind. A removed habit
  // keeps its rows (`removedOn` is the day it ended). At most five are open for a student, checked by `habits.add`.
  habitPlans: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    kind: v.string(), // a code from HABIT_KINDS (habitRules.ts)
    title: v.string(), // 1 to 40 code points, one line
    color: v.string(), // one of the eight HABIT_COLORS
    startOn: v.string(), // YYYY-MM-DD
    endOn: v.string(),
    removedOn: v.optional(v.string()),
  })
    .index("by_memberId", ["memberId"])
    .index("by_memberId_and_removedOn_and_endOn", ["memberId", "removedOn", "endOn"]),

  // One row for each habit and day, made at the first tick (spec house/0007). `lit` is the current state, `flips` how many times it changed after the
  // first tick (at most 6). A miss is a day with no lit row and is never stored. Erase class `erased`.
  habitChecks: defineTable({
    planId: v.id("habitPlans"),
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    day: v.string(),
    lit: v.boolean(),
    flips: v.number(),
  })
    .index("by_planId_and_day", ["planId", "day"])
    .index("by_memberId", ["memberId"]),

  // Counseling (spec house/0024). A counselor opens their own 30 minute slots; a student books one. A slot holds the counselor and the time only.
  // `status` is "open", "booked" or "closed" (the counselor took it back before anyone booked). Erase class `kept` (no student in it).
  counselSlots: defineTable({
    counselorMemberId: v.id("members"),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_counselorMemberId_and_startsAt", ["counselorMemberId", "startsAt"])
    .index("by_status_and_startsAt", ["status", "startsAt"]),

  // A student's booking of a slot: their own optional note (at most 300 letters), and after the session the counselor's short summary, which only
  // this student and this counselor read. The session is a Stream Video call inside the house (call type dhi_counsel, call id = this booking's id),
  // recorded and transcribed on Stream (owner, 2026-10-27); the recording and the transcript stay on Stream and are never copied into a DHI table. `status` is "booked",
  // "cancelled_by_student", "cancelled_by_counselor" or "done". Seen by the student and the counselor they booked, never by school staff or a DHI
  // admin. Erase class `erased`.
  counselBookings: defineTable({
    slotId: v.id("counselSlots"),
    counselorMemberId: v.id("members"),
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    startsAt: v.number(),
    note: v.optional(v.string()),
    status: v.string(),
    summary: v.optional(v.string()),
    summaryAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_memberId_and_startsAt", ["memberId", "startsAt"])
    .index("by_counselorMemberId_and_startsAt", ["counselorMemberId", "startsAt"])
    .index("by_slotId", ["slotId"]),

  // Who the counselor of a session shared its recording and transcript with, on request (owner, 2026-10-27). The recording itself stays on Stream
  // and is never copied into a DHI table; this row only lets that person open it from the house. Erase class `erased` (with the student).
  counselShares: defineTable({
    bookingId: v.id("counselBookings"),
    memberId: v.id("members"), // who may now open the recording
    sharedBy: v.id("members"), // the counselor
    at: v.number(),
  })
    .index("by_bookingId", ["bookingId"])
    .index("by_memberId", ["memberId"]),

  // The DHI desk (spec house/0016). One row: the coins DHI gives each student every month, set by a DHI admin only. Kept, no student in it.
  deskSettings: defineTable({
    monthlyCoins: v.number(),
    setBy: v.id("members"),
    updatedAt: v.number(),
  }),

  // The desk's count of questions sent to the model on one India day (YYYY-MM-DD), for the whole deployment: the daily cap reads it, and it is the
  // spend count to watch after launch. One row a day, written only by `desk.begin`. No student in it; erase class `system`.
  deskDaily: defineTable({
    day: v.string(),
    questions: v.number(),
  }).index("by_day", ["day"]),

  // A student's coins. One row, made at the first visit. `grantedMonth` is the India month (YYYY-MM) the allotment was last added for, so the month's
  // coins are added once, the first time the student asks that month, and the balance rolls over. The balance never goes below zero: a question
  // takes its coins in the same step that stores it. Erase class `erased`.
  deskWallets: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    balance: v.number(),
    grantedMonth: v.string(),
  }).index("by_memberId", ["memberId"]),

  // A student's saved talk. Erase class `erased`, seen by the student alone.
  deskThreads: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    title: v.string(), // the first line of the first question, cut short
    lastAt: v.number(),
  }).index("by_memberId_and_lastAt", ["memberId", "lastAt"]),

  // One question and its answer. `status` is `pending` (coins taken, the model not yet answered), `answered` or `failed` (the coins were returned).
  // `cached` is true when the answer came from `deskCache` for 0 coins and no model call. The model name and the token counts are the cost ledger
  // (Desk Design, model gateway). Erase class `erased`.
  deskTurns: defineTable({
    threadId: v.id("deskThreads"),
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    kind: v.string(), // a code from DESK_KINDS (deskRules.ts)
    question: v.string(),
    answer: v.optional(v.string()),
    status: v.string(),
    coinsSpent: v.number(),
    cached: v.boolean(),
    model: v.optional(v.string()),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_memberId", ["memberId"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  // Answers kept so a repeated question costs nothing and calls no model. Scoped to one institute and keyed by the kind and the cleaned question
  // (`cacheKeyOf`). Holds no student: no member id, and a question with an email or a phone number is never stored. Kept; served for 90 days.
  deskCache: defineTable({
    instituteId: v.id("institutes"),
    key: v.string(),
    answer: v.string(),
    hits: v.number(),
    createdAt: v.number(),
  })
    .index("by_instituteId_and_key", ["instituteId", "key"])
    .index("by_createdAt", ["createdAt"]), // the retention sweep deletes an answer after its 90 days

  // A desk sitting (spec house/0018, desk part): a run of questions with no gap over 15 minutes, kept so the after session card can be offered. `startedAt`
  // is the first question, `lastAt` the latest. `feedbackStatus` is empty while the sitting is open, then `none` (under 10 minutes), `pending`, `answered` or
  // `skipped`. The minute job in `deskSitting.closeSittings` sets it. Erase class `erased`; seen by the student alone.
  deskSittings: defineTable({
    memberId: v.id("members"),
    instituteId: v.id("institutes"),
    startedAt: v.number(),
    lastAt: v.number(),
    feedbackStatus: v.optional(v.string()),
    feel: v.optional(v.string()),
    focus: v.optional(v.number()),
    subject: v.optional(v.string()),
    // Questions asked in the sitting, and how many of them were an active learning kind (write, paper or mock). Counts only, for the Brain's A10 and A12.
    turns: v.optional(v.number()),
    activeTurns: v.optional(v.number()),
  })
    .index("by_memberId_and_lastAt", ["memberId", "lastAt"])
    .index("by_feedbackStatus_and_lastAt", ["feedbackStatus", "lastAt"]),

  // The room event log (spec house/0004). Append only: no app code updates or deletes a row (the only removal is the erase of spec house/0005).
  // Written only by `recordEvent` in eventLog.ts, inside a room's own mutation; no public function reads or writes it. Erase class `erased`:
  // an event is personal data, and a student's export and erase (house/0005) are the only ways one leaves. `payload` holds ids, numbers,
  // booleans and fixed codes only (eventShapes.ts), at most 2 KB, never a student's own words. `loggedFor` is a `YYYY-MM-DD` India day (dayRules.ts)
  // worked out by the server. Uniqueness of (memberId, eventKey) holds only because `recordEvent` looks it up first.
  events: defineTable({
    memberId: v.id("members"), // the student it is about
    actorId: v.union(v.id("members"), v.literal("system")), // who caused it
    instituteId: v.id("institutes"), // at the moment of writing
    classId: v.optional(v.id("classes")), // at the moment of writing; a later class change never rewrites it
    room: v.string(), // a code from ROOMS
    type: v.string(), // a code from the registry
    schemaVer: v.number(), // the registry version the payload was checked against
    payload: v.any(),
    occurredAt: v.number(),
    loggedFor: v.string(),
    late: v.boolean(),
    voided: v.optional(v.boolean()), // true when this event undoes the thing it is about
    eventKey: v.string(), // `table:id`, at most 100; one stored event for each (memberId, eventKey)
    about: v.optional(v.string()), // `table:id`: the thing, so the latest event for a thing and day is the current one
    replaces: v.optional(v.id("events")), // an audit link to the earlier event this one corrects
  })
    .index("by_memberId_and_loggedFor", ["memberId", "loggedFor"])
    .index("by_memberId_and_eventKey", ["memberId", "eventKey"])
    .index("by_memberId_and_about_and_loggedFor", ["memberId", "about", "loggedFor"])
    .index("by_memberId_and_room_and_loggedFor", ["memberId", "room", "loggedFor"]), // class totals probe one room at a time (house spec 0005, AC-23)

  // The first answer of a class total (spec house/0005, AC-23). A total for one class, one kind and one complete month is worked out once and
  // then served as it was, so an institute admin cannot take two answers, pause or move one student between them, and subtract. Counts only, no
  // person in it. Erase class `kept`. `count` is absent when fewer than 10 students stood behind it.
  classTotals: defineTable({
    classId: v.id("classes"),
    kind: v.string(),
    month: v.string(), // YYYY-MM
    count: v.optional(v.number()),
  }).index("by_classId_and_kind_and_month", ["classId", "kind", "month"]),

  // One row: the one at a time lease of the copy job, and the numbers the Sync status tab shows.
  sheetStatus: defineTable({
    lastRunAt: v.number(),
    lastSuccessAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    leaseUntil: v.optional(v.number()),
    pruneNote: v.optional(v.string()), // one short line about the last prune: counts only, never a code or a name
  }),
});
