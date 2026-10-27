/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as accessRules from "../accessRules.js";
import type * as auth from "../auth.js";
import type * as avatarCore from "../avatarCore.js";
import type * as avatarHttp from "../avatarHttp.js";
import type * as avatarState from "../avatarState.js";
import type * as avatars from "../avatars.js";
import type * as blog from "../blog.js";
import type * as blogRoom from "../blogRoom.js";
import type * as blogRules from "../blogRules.js";
import type * as bootstrap from "../bootstrap.js";
import type * as brain from "../brain.js";
import type * as brainCodes from "../brainCodes.js";
import type * as brainDay from "../brainDay.js";
import type * as brainFixtures from "../brainFixtures.js";
import type * as brainProof from "../brainProof.js";
import type * as brainRollup from "../brainRollup.js";
import type * as brainRoom from "../brainRoom.js";
import type * as brainRules from "../brainRules.js";
import type * as challenge from "../challenge.js";
import type * as challengeAdmin from "../challengeAdmin.js";
import type * as challengeAdminCore from "../challengeAdminCore.js";
import type * as challengeBoard from "../challengeBoard.js";
import type * as challengeCore from "../challengeCore.js";
import type * as challengeRules from "../challengeRules.js";
import type * as checks from "../checks.js";
import type * as classes from "../classes.js";
import type * as connectionRules from "../connectionRules.js";
import type * as consent from "../consent.js";
import type * as consentRules from "../consentRules.js";
import type * as consentState from "../consentState.js";
import type * as consentText from "../consentText.js";
import type * as counsel from "../counsel.js";
import type * as counselCall from "../counselCall.js";
import type * as counselProof from "../counselProof.js";
import type * as counselRoom from "../counselRoom.js";
import type * as counselRules from "../counselRules.js";
import type * as crons from "../crons.js";
import type * as dataMap from "../dataMap.js";
import type * as dataRights from "../dataRights.js";
import type * as dayRules from "../dayRules.js";
import type * as demo from "../demo.js";
import type * as desk from "../desk.js";
import type * as deskAsk from "../deskAsk.js";
import type * as deskRoom from "../deskRoom.js";
import type * as deskRules from "../deskRules.js";
import type * as deskSitting from "../deskSitting.js";
import type * as eraseCore from "../eraseCore.js";
import type * as eventData from "../eventData.js";
import type * as eventLog from "../eventLog.js";
import type * as eventProof from "../eventProof.js";
import type * as eventRegistry from "../eventRegistry.js";
import type * as eventShapes from "../eventShapes.js";
import type * as eventTypes_blog from "../eventTypes/blog.js";
import type * as eventTypes_desk from "../eventTypes/desk.js";
import type * as eventTypes_exams from "../eventTypes/exams.js";
import type * as eventTypes_habits from "../eventTypes/habits.js";
import type * as eventTypes_hour from "../eventTypes/hour.js";
import type * as eventTypes_meals from "../eventTypes/meals.js";
import type * as eventTypes_modules from "../eventTypes/modules.js";
import type * as eventTypes_mood from "../eventTypes/mood.js";
import type * as eventTypes_sleep from "../eventTypes/sleep.js";
import type * as eventTypes_test from "../eventTypes/test.js";
import type * as examLock from "../examLock.js";
import type * as exams from "../exams.js";
import type * as feedback from "../feedback.js";
import type * as feedbackRules from "../feedbackRules.js";
import type * as filmRoom from "../filmRoom.js";
import type * as films from "../films.js";
import type * as filmsProof from "../filmsProof.js";
import type * as foodRules from "../foodRules.js";
import type * as foods from "../foods.js";
import type * as funnelLink from "../funnelLink.js";
import type * as habitCodes from "../habitCodes.js";
import type * as habitProof from "../habitProof.js";
import type * as habitRoom from "../habitRoom.js";
import type * as habitRules from "../habitRules.js";
import type * as habits from "../habits.js";
import type * as health from "../health.js";
import type * as helpers from "../helpers.js";
import type * as home from "../home.js";
import type * as homeRules from "../homeRules.js";
import type * as hourCall from "../hourCall.js";
import type * as hourCallRules from "../hourCallRules.js";
import type * as hourProof from "../hourProof.js";
import type * as hourRoom from "../hourRoom.js";
import type * as hourRules from "../hourRules.js";
import type * as hourShares from "../hourShares.js";
import type * as houseAuth from "../houseAuth.js";
import type * as houseCore from "../houseCore.js";
import type * as http from "../http.js";
import type * as institutes from "../institutes.js";
import type * as inviteCore from "../inviteCore.js";
import type * as invites from "../invites.js";
import type * as leads from "../leads.js";
import type * as limits from "../limits.js";
import type * as meals from "../meals.js";
import type * as mealsRoom from "../mealsRoom.js";
import type * as members from "../members.js";
import type * as metricRules from "../metricRules.js";
import type * as moduleRules from "../moduleRules.js";
import type * as moodProof from "../moodProof.js";
import type * as moodRoom from "../moodRoom.js";
import type * as moodRules from "../moodRules.js";
import type * as moods from "../moods.js";
import type * as paperRoom from "../paperRoom.js";
import type * as papers from "../papers.js";
import type * as papersProof from "../papersProof.js";
import type * as papersRules from "../papersRules.js";
import type * as parentLink from "../parentLink.js";
import type * as parentLinkCore from "../parentLinkCore.js";
import type * as parentReport from "../parentReport.js";
import type * as parentRules from "../parentRules.js";
import type * as pauseHistory from "../pauseHistory.js";
import type * as purge from "../purge.js";
import type * as referral from "../referral.js";
import type * as referralHttp from "../referralHttp.js";
import type * as rehearsalProof from "../rehearsalProof.js";
import type * as reportCopy from "../reportCopy.js";
import type * as reportCore from "../reportCore.js";
import type * as reportHttp from "../reportHttp.js";
import type * as reportMake from "../reportMake.js";
import type * as reportMakeCore from "../reportMakeCore.js";
import type * as reportVersion from "../reportVersion.js";
import type * as results from "../results.js";
import type * as resultsCore from "../resultsCore.js";
import type * as retention from "../retention.js";
import type * as roomRegistry from "../roomRegistry.js";
import type * as schoolReport from "../schoolReport.js";
import type * as schoolRules from "../schoolRules.js";
import type * as scoring from "../scoring.js";
import type * as sessionFeedback from "../sessionFeedback.js";
import type * as sessionRules from "../sessionRules.js";
import type * as shareCore from "../shareCore.js";
import type * as shareHttp from "../shareHttp.js";
import type * as sharePayload from "../sharePayload.js";
import type * as shares from "../shares.js";
import type * as sharing from "../sharing.js";
import type * as sheetAdmin from "../sheetAdmin.js";
import type * as sheetFlush from "../sheetFlush.js";
import type * as sheetFlushCore from "../sheetFlushCore.js";
import type * as sheetRows from "../sheetRows.js";
import type * as sheetRowsCore from "../sheetRowsCore.js";
import type * as sheetSync from "../sheetSync.js";
import type * as sheetsGoogle from "../sheetsGoogle.js";
import type * as sleep from "../sleep.js";
import type * as sleepProof from "../sleepProof.js";
import type * as sleepRoom from "../sleepRoom.js";
import type * as sleepRules from "../sleepRules.js";
import type * as staffHome from "../staffHome.js";
import type * as staffRead from "../staffRead.js";
import type * as students from "../students.js";
import type * as studyHour from "../studyHour.js";
import type * as team from "../team.js";
import type * as teamCore from "../teamCore.js";
import type * as teamHttp from "../teamHttp.js";
import type * as trustedOrigins from "../trustedOrigins.js";
import type * as waiting from "../waiting.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  accessRules: typeof accessRules;
  auth: typeof auth;
  avatarCore: typeof avatarCore;
  avatarHttp: typeof avatarHttp;
  avatarState: typeof avatarState;
  avatars: typeof avatars;
  blog: typeof blog;
  blogRoom: typeof blogRoom;
  blogRules: typeof blogRules;
  bootstrap: typeof bootstrap;
  brain: typeof brain;
  brainCodes: typeof brainCodes;
  brainDay: typeof brainDay;
  brainFixtures: typeof brainFixtures;
  brainProof: typeof brainProof;
  brainRollup: typeof brainRollup;
  brainRoom: typeof brainRoom;
  brainRules: typeof brainRules;
  challenge: typeof challenge;
  challengeAdmin: typeof challengeAdmin;
  challengeAdminCore: typeof challengeAdminCore;
  challengeBoard: typeof challengeBoard;
  challengeCore: typeof challengeCore;
  challengeRules: typeof challengeRules;
  checks: typeof checks;
  classes: typeof classes;
  connectionRules: typeof connectionRules;
  consent: typeof consent;
  consentRules: typeof consentRules;
  consentState: typeof consentState;
  consentText: typeof consentText;
  counsel: typeof counsel;
  counselCall: typeof counselCall;
  counselProof: typeof counselProof;
  counselRoom: typeof counselRoom;
  counselRules: typeof counselRules;
  crons: typeof crons;
  dataMap: typeof dataMap;
  dataRights: typeof dataRights;
  dayRules: typeof dayRules;
  demo: typeof demo;
  desk: typeof desk;
  deskAsk: typeof deskAsk;
  deskRoom: typeof deskRoom;
  deskRules: typeof deskRules;
  deskSitting: typeof deskSitting;
  eraseCore: typeof eraseCore;
  eventData: typeof eventData;
  eventLog: typeof eventLog;
  eventProof: typeof eventProof;
  eventRegistry: typeof eventRegistry;
  eventShapes: typeof eventShapes;
  "eventTypes/blog": typeof eventTypes_blog;
  "eventTypes/desk": typeof eventTypes_desk;
  "eventTypes/exams": typeof eventTypes_exams;
  "eventTypes/habits": typeof eventTypes_habits;
  "eventTypes/hour": typeof eventTypes_hour;
  "eventTypes/meals": typeof eventTypes_meals;
  "eventTypes/modules": typeof eventTypes_modules;
  "eventTypes/mood": typeof eventTypes_mood;
  "eventTypes/sleep": typeof eventTypes_sleep;
  "eventTypes/test": typeof eventTypes_test;
  examLock: typeof examLock;
  exams: typeof exams;
  feedback: typeof feedback;
  feedbackRules: typeof feedbackRules;
  filmRoom: typeof filmRoom;
  films: typeof films;
  filmsProof: typeof filmsProof;
  foodRules: typeof foodRules;
  foods: typeof foods;
  funnelLink: typeof funnelLink;
  habitCodes: typeof habitCodes;
  habitProof: typeof habitProof;
  habitRoom: typeof habitRoom;
  habitRules: typeof habitRules;
  habits: typeof habits;
  health: typeof health;
  helpers: typeof helpers;
  home: typeof home;
  homeRules: typeof homeRules;
  hourCall: typeof hourCall;
  hourCallRules: typeof hourCallRules;
  hourProof: typeof hourProof;
  hourRoom: typeof hourRoom;
  hourRules: typeof hourRules;
  hourShares: typeof hourShares;
  houseAuth: typeof houseAuth;
  houseCore: typeof houseCore;
  http: typeof http;
  institutes: typeof institutes;
  inviteCore: typeof inviteCore;
  invites: typeof invites;
  leads: typeof leads;
  limits: typeof limits;
  meals: typeof meals;
  mealsRoom: typeof mealsRoom;
  members: typeof members;
  metricRules: typeof metricRules;
  moduleRules: typeof moduleRules;
  moodProof: typeof moodProof;
  moodRoom: typeof moodRoom;
  moodRules: typeof moodRules;
  moods: typeof moods;
  paperRoom: typeof paperRoom;
  papers: typeof papers;
  papersProof: typeof papersProof;
  papersRules: typeof papersRules;
  parentLink: typeof parentLink;
  parentLinkCore: typeof parentLinkCore;
  parentReport: typeof parentReport;
  parentRules: typeof parentRules;
  pauseHistory: typeof pauseHistory;
  purge: typeof purge;
  referral: typeof referral;
  referralHttp: typeof referralHttp;
  rehearsalProof: typeof rehearsalProof;
  reportCopy: typeof reportCopy;
  reportCore: typeof reportCore;
  reportHttp: typeof reportHttp;
  reportMake: typeof reportMake;
  reportMakeCore: typeof reportMakeCore;
  reportVersion: typeof reportVersion;
  results: typeof results;
  resultsCore: typeof resultsCore;
  retention: typeof retention;
  roomRegistry: typeof roomRegistry;
  schoolReport: typeof schoolReport;
  schoolRules: typeof schoolRules;
  scoring: typeof scoring;
  sessionFeedback: typeof sessionFeedback;
  sessionRules: typeof sessionRules;
  shareCore: typeof shareCore;
  shareHttp: typeof shareHttp;
  sharePayload: typeof sharePayload;
  shares: typeof shares;
  sharing: typeof sharing;
  sheetAdmin: typeof sheetAdmin;
  sheetFlush: typeof sheetFlush;
  sheetFlushCore: typeof sheetFlushCore;
  sheetRows: typeof sheetRows;
  sheetRowsCore: typeof sheetRowsCore;
  sheetSync: typeof sheetSync;
  sheetsGoogle: typeof sheetsGoogle;
  sleep: typeof sleep;
  sleepProof: typeof sleepProof;
  sleepRoom: typeof sleepRoom;
  sleepRules: typeof sleepRules;
  staffHome: typeof staffHome;
  staffRead: typeof staffRead;
  students: typeof students;
  studyHour: typeof studyHour;
  team: typeof team;
  teamCore: typeof teamCore;
  teamHttp: typeof teamHttp;
  trustedOrigins: typeof trustedOrigins;
  waiting: typeof waiting;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
