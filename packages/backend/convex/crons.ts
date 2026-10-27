// Scheduled jobs. The daily clean up of abandoned sign in accounts (spec 0002, AC-10), and the copy of leads and
// feedback to the team's Google Sheet every 5 minutes (spec 0004): it only starts the Node job when some row is due.
// A daily check queues the rows whose content changed since they were last sent.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily("purge abandoned sign in accounts", { hourUTC: 21, minuteUTC: 0 }, internal.purge.purgeAbandoned, {});
crons.interval("copy leads and feedback to the Sheet", { minutes: 5 }, internal.sheetSync.runIfDue, {});
crons.daily("queue Sheet rows whose content changed", { hourUTC: 20, minuteUTC: 30 }, internal.sheetSync.dailyCheck, { kind: "lead" });
// The saved report PDF (spec 0006): the minute job restarts the copy job (retries, a job that died), and the daily sweep
// deletes stored files no row holds.
crons.interval("make due report copies", { minutes: 1 }, internal.reportMake.runIfDue, {});
crons.daily("delete unattached report files", { hourUTC: 21, minuteUTC: 30 }, internal.reportCopy.sweep, {});
// The live challenge (spec 0015): every 5 minutes settle pending referrals and recount. Does nothing while CHALLENGE_LIVE is off.
crons.interval("settle challenge referrals", { minutes: 5 }, internal.challengeBoard.run, {});
// The house (spec house/0005, AC-15): old view records, long removed members and ended erase blocks.
// The study hour (spec house/0015): every minute, drop the seats whose heartbeat stopped and the seats of an hour that has closed.
crons.interval("drop idle study hour seats", { minutes: 1 }, internal.studyHour.sweep, {});
// Study hour call recordings are deleted on Stream after 30 days (house spec 0027).
crons.daily("delete old study hour recordings", { hourUTC: 22, minuteUTC: 15 }, internal.hourCall.sweepRecordings, {});
// The exams room (spec house/0012): every minute, close the sittings whose window has ended, so a paper nobody opens still becomes a miss.
crons.interval("close due exam sittings", { minutes: 1 }, internal.exams.sweep, {});
// The Brain (spec house/0019): every minute, keep the daily values up to date from the new events; each morning after the house day turns, close
// the last two days for every student and then check the stored days against the events; every ten minutes, rebuild days stored under an older formula.
crons.interval("update the Brain's daily values", { minutes: 1 }, internal.brainRollup.run, {});
crons.daily("close yesterday for the Brain", { hourUTC: 22, minuteUTC: 45 }, internal.brainRollup.closeYesterday, {});
crons.daily("check the Brain's stored days", { hourUTC: 23, minuteUTC: 15 }, internal.brainRollup.reconcile, {});
crons.interval("rebuild stale Brain days", { minutes: 10 }, internal.brainRollup.rebuildStale, {});
// The DHI desk (spec house/0016): every minute, give up questions the model never answered and return their coins.
crons.interval("return coins of unanswered desk questions", { minutes: 1 }, internal.desk.sweepPending, {});
// The desk's after session card (spec house/0018): every minute, end the desk sittings that were idle for 15 minutes.
crons.interval("end idle desk sittings", { minutes: 1 }, internal.deskSitting.closeSittings, {});
crons.daily("house retention sweep", { hourUTC: 22, minuteUTC: 0 }, internal.retention.sweep, {});
export default crons;
