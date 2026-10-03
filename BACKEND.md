# DHI student house — backend brief

This repository is the **student dashboard UI**. It is a working demo for one seat, **Suzzy Glass**. Almost every number the screen shows is **local demo data** (`localStorage` or a file under `src/lib/dhi`). There is no production API yet.

Your job is to replace that demo store with a real backend. Do not redesign the rooms. The screens already decide the rules.

Demo login: any email opens the house. Session key is `dhi-session-v1`. That is a placeholder. Real entry is **invite only**.

## What this product is

DHI is a B2B house for an institute’s students.

- The institute pays to see growth, papers, and feedback. They do not run counseling, modules, or the study-hour clock.
- DHI master admin owns modules, counselor access, coin allotment, and which rooms an institute may show.
- A teacher builds a paper (MCQ and long writing), sends it to a class or to one student, then marks it with remarks.
- A student sits the paper, logs meals, mood, and habits, watches house films, writes a blog, and can enter a study hour only while the admin clock is open.
- Counseling is a DHI service. The student books a slot. DHI may help with infrastructure and a written summary after the meeting. **DHI never reads or stores the counselor recording.**

Do not label a student weak, average, or bright. Scores are growth marks (Gurukul), not a rank that shames them.

## Roles

One login screen. The account’s role opens the right house. This repo only builds the **student** house.

| Role | May do |
|---|---|
| Student | Everything in the left menu of this app, for their own rows |
| Teacher | Build and send papers, mark answers, remarks, academic preview only |
| Institute admin | Read growth, papers, and feedback for their students. Request a module; they cannot publish one |
| DHI master | Coins, modules, study-hour clock, counselor roster, institute access |
| Counselor | Their own booked sessions. No access to exam answers or other students |

Every row that belongs to a person carries `student_id` and `institute_id`. Never return another institute’s rows.

## Rooms in this repo

Menu is `src/routes/home.tsx`. Each room is a component under `src/components/dhi`. The rules live next to the demo data in `src/lib/dhi`.

| Room | UI | Demo data | Rule the API must keep |
|---|---|---|---|
| Home | `src/routes/home.tsx` | `src/lib/dhi/home-demo.ts` | Greeting, DHI score, open exams, quick tiles |
| Exams | `papers-desk.tsx` | `papers-demo.ts` | Window has `opens_at` / `due_at`. After due, the tile leaves and the miss is stored. Starting locks the other menus. MCQ hint is a slider and must **not** reveal the answer. Submit goes to the teacher. Student accepts feedback |
| Meals | `meal-tracker.tsx` | `meals-demo.ts` | Indian plate: item, count (rotis), meal (breakfast, lunch, dinner, snack), time. Custom dishes are allowed. Macros may arrive later. Day resets; the week does not |
| Mood | `mood-tracker.tsx` | `mood-demo.ts` | One colour a day, their own words, DHI line. Help request creates a counselor booking, not a chat with the model |
| Habits | `habits/` | `habits/schema.ts`, `store.ts` | At most 5. Own label, start, end, daily tick, streak. Misses stay visible |
| Modules | `modules/` | `modules/catalog.ts` | **House upload only.** Student cannot add a film. Score is written once, when playback reaches the end. Seek past the watched point stays closed until then |
| Blog | `blog/` | `blog/posts.ts` | Student posts. One photo, title, tag, body. Marks allowed: bold, italic, numbered list. Comments are plain text |
| DHI desk | `desk/` | `desk/schema.ts` | Coins. Clarify is free. A cache hit costs 0 and must not call the model again |
| Study hour | `study/` | `study/schema.ts`, `hours.ts` | Opens only inside `[opens_at, closes_at]` set by DHI admin. Leave or clock-end drops the seat. Live = self large, others beside. Away = profile only. DND = no people, no chat |

Coin costs in `src/lib/dhi/desk/schema.ts`: chat 1, write 2, paper 2, mock 4, story 5, draw 8. Admin sets the month’s allotment. A later purchase only adds `bonus`.

## Tables to build

Names below match the comments already in the schema files. Use them. Add `institute_id` on every student-owned table.

**Identity**

- `institutes` — id, name, plan
- `users` — id, institute_id nullable, email, role (`student|teacher|institute_admin|dhi_admin|counselor`), name
- `invites` — email, role, institute_id, code, used_at
- Session is the invite, not a public signup

**Exams**

- `papers` — id, teacher_id, subject, title, opens_at, due_at, duration_sec, mcq[], writing[]
- `paper_assignments` — paper_id, student_id (one student or a whole class expanded into rows)
- `attempts` — student_id, paper_id, started_at, submitted_at, answers jsonb
- `marks` — attempt_id, question_id, score, remark
- `misses` — student_id, paper_id, due_at. Written when the window closes with no submit. Feeds the DHI score down. Do not delete the attempt history

**Body and mind**

- `plates` — student_id, day, meal, eaten_at, items[{name, qty, unit, kcal, carbs, protein, fat, source}]
- `mood_days` — student_id, day, colour, note, dhi_line
- `habits` — student_id, name, colour, start_on, end_on
- `habit_ticks` — habit_id, day, done
- `counsel_requests` — student_id, note, slot, status. From the mood help button

**Desk**

- `dhi_wallets` — student_id, period_start, allotment, bonus, spent
- `dhi_threads`, `dhi_messages`, `dhi_canvas`, `dhi_cache`, `dhi_attachments`
- Cache key is a normalised prompt. Hit returns the stored payload and spends 0
- Attachments are study files. Never put a counselor recording in this table

**House content**

- `modules` — id, title, category (`Academic|Self help|Mental health`), video_path, score_value. Written by DHI admin
- `module_progress` — student_id, module_id, ratio, kept_at
- `study_hours` — id, subject, teacher, opens_at, closes_at, voice, video
- `study_seats` — hour_id, user_id, presence (`live|away|offline|dnd`)
- `study_messages` — hour_id, author_id, body, at
- `blogs` — student_id, title, tag, html, photo_path, created_at
- `blog_comments` — blog_id, author_id, body

Sanitize blog HTML on write. Allow only `p`, `br`, `b`, `strong`, `i`, `em`, `ol`, `li`. The UI already does this in `src/components/dhi/blog/blog-room.tsx` (`safeHtml`). Repeat it on the server.

## DHI score

One number on the home, not a label.

Inputs that already exist in the demo and should stay:

- exams sat before the window closes, and misses
- study time inside an open hour
- modules kept
- habit ticks
- mood and meal logs (presence, not a judgement)

Teacher remarks and paper marks are visible to the student and to the institute academic preview. The institute does not get the counseling note or the recording.

## What is fake today

These keys are the contract to replace. Read them, then serve the same shapes.

| Key | File |
|---|---|
| `dhi-session-v1` | `src/lib/session.ts` |
| `dhi-desk-v1` | `src/lib/dhi/desk/store.ts` |
| `dhi-blog-v1` | `src/lib/dhi/blog/posts.ts` |
| `dhi-habits` store | `src/lib/dhi/habits/store.ts` |
| meals store | `src/lib/dhi/meals-demo.ts` |
| mood store | `src/lib/dhi/mood-demo.ts` |
| `dhi-modules-v1` | `src/lib/dhi/modules/catalog.ts` |
| exam attempts | `src/components/dhi/papers-desk.tsx` |

Study hours are not stored. `src/lib/dhi/study/hours.ts` builds one live hour and one locked hour from `Date.now()` so the demo can be opened.

Landing video files are `public/landing/day.mp4` and `night.mp4`. Module films point at those files until real uploads exist. Store uploads in object storage. Save only the path.

## Run the UI

```bash
npm install
npm run dev
```

The demo opens straight into Suzzy’s house. **Leave** returns to the lake. **Sign in** comes back. Do not treat that as the auth design.

## Do not

- Do not let a student upload a module.
- Do not open a study hour before `opens_at` or keep the socket after `closes_at`.
- Do not send the answer in an MCQ hint.
- Do not let the institute admin edit counseling, coins, or modules.
- Do not run the model on a cache hit.
- Do not store counselor recordings in DHI tables, logs, or the desk cache.
