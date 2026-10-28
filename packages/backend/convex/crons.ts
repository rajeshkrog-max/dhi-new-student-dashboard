// Scheduled jobs. The daily clean up of abandoned sign in accounts (spec 0002, AC-10), and the copy of leads and
// feedback to the team's Google Sheet every 5 minutes (spec 0004): it only starts the Node job when some row is due.
// A daily check queues the rows whose content changed since they were last sent.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily("purge abandoned sign in accounts", { hourUTC: 21, minuteUTC: 0 }, internal.purge.purgeAbandoned, {});
crons.interval("copy leads and feedback to the Sheet", { minutes: 5 }, internal.sheetSync.runIfDue, {});
crons.daily("queue Sheet rows whose content changed", { hourUTC: 20, minuteUTC: 30 }, internal.sheetSync.dailyCheck, { kind: "lead" });
// The one minute job (house spec 0029, to stay inside the free plan): it asks each frequent job whether it has work and starts only those that do. It
// replaces six jobs that each ran every minute and the ten minute rebuild: the saved report copy (spec 0006: retries, a job that died), the study hour's
// idle seats (house spec 0015), the due exam sittings (house spec 0012, so a paper nobody opens still becomes a miss), the Brain's daily values from the
// new events (house spec 0019) and every tenth minute its stale days, the desk's unanswered questions (house spec 0016) and its idle sittings (0018).
crons.interval("start the frequent jobs that have work", { minutes: 1 }, internal.minuteTick.tick, {});
// The saved report PDF (spec 0006): the daily sweep deletes stored files no row holds.
crons.daily("delete unattached report files", { hourUTC: 21, minuteUTC: 30 }, internal.reportCopy.sweep, {});
// The live challenge (spec 0015): every 5 minutes settle pending referrals and recount. Does nothing while CHALLENGE_LIVE is off.
crons.interval("settle challenge referrals", { minutes: 5 }, internal.challengeBoard.run, {});
// The house (spec house/0005, AC-15): old view records, long removed members and ended erase blocks.
// Study hour call recordings are deleted on Stream after 30 days (house spec 0027).
crons.daily("delete old study hour recordings", { hourUTC: 22, minuteUTC: 15 }, internal.hourCall.sweepRecordings, {});
// The Brain (spec house/0019): each morning after the house day turns, close the last two days for every student and then check the stored days
// against the events. (The minute updates and the rebuild of stale days are started by the minute job.)
crons.daily("close yesterday for the Brain", { hourUTC: 22, minuteUTC: 45 }, internal.brainRollup.closeYesterday, {});
crons.daily("check the Brain's stored days", { hourUTC: 23, minuteUTC: 15 }, internal.brainRollup.reconcile, {});
crons.daily("house retention sweep", { hourUTC: 22, minuteUTC: 0 }, internal.retention.sweep, {});
export default crons;
