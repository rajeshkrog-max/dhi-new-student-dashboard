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
import type * as bootstrap from "../bootstrap.js";
import type * as challenge from "../challenge.js";
import type * as challengeAdmin from "../challengeAdmin.js";
import type * as challengeAdminCore from "../challengeAdminCore.js";
import type * as challengeBoard from "../challengeBoard.js";
import type * as challengeCore from "../challengeCore.js";
import type * as challengeRules from "../challengeRules.js";
import type * as checks from "../checks.js";
import type * as classes from "../classes.js";
import type * as consent from "../consent.js";
import type * as consentRules from "../consentRules.js";
import type * as consentState from "../consentState.js";
import type * as consentText from "../consentText.js";
import type * as crons from "../crons.js";
import type * as dataMap from "../dataMap.js";
import type * as dataRights from "../dataRights.js";
import type * as dayRules from "../dayRules.js";
import type * as demo from "../demo.js";
import type * as eraseCore from "../eraseCore.js";
import type * as eventData from "../eventData.js";
import type * as eventLog from "../eventLog.js";
import type * as eventProof from "../eventProof.js";
import type * as eventRegistry from "../eventRegistry.js";
import type * as eventShapes from "../eventShapes.js";
import type * as eventTypes_test from "../eventTypes/test.js";
import type * as feedback from "../feedback.js";
import type * as feedbackRules from "../feedbackRules.js";
import type * as health from "../health.js";
import type * as helpers from "../helpers.js";
import type * as houseAuth from "../houseAuth.js";
import type * as houseCore from "../houseCore.js";
import type * as http from "../http.js";
import type * as institutes from "../institutes.js";
import type * as inviteCore from "../inviteCore.js";
import type * as invites from "../invites.js";
import type * as leads from "../leads.js";
import type * as limits from "../limits.js";
import type * as members from "../members.js";
import type * as purge from "../purge.js";
import type * as referral from "../referral.js";
import type * as referralHttp from "../referralHttp.js";
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
import type * as scoring from "../scoring.js";
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
import type * as staffRead from "../staffRead.js";
import type * as students from "../students.js";
import type * as team from "../team.js";
import type * as teamCore from "../teamCore.js";
import type * as teamHttp from "../teamHttp.js";
import type * as trustedOrigins from "../trustedOrigins.js";

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
  bootstrap: typeof bootstrap;
  challenge: typeof challenge;
  challengeAdmin: typeof challengeAdmin;
  challengeAdminCore: typeof challengeAdminCore;
  challengeBoard: typeof challengeBoard;
  challengeCore: typeof challengeCore;
  challengeRules: typeof challengeRules;
  checks: typeof checks;
  classes: typeof classes;
  consent: typeof consent;
  consentRules: typeof consentRules;
  consentState: typeof consentState;
  consentText: typeof consentText;
  crons: typeof crons;
  dataMap: typeof dataMap;
  dataRights: typeof dataRights;
  dayRules: typeof dayRules;
  demo: typeof demo;
  eraseCore: typeof eraseCore;
  eventData: typeof eventData;
  eventLog: typeof eventLog;
  eventProof: typeof eventProof;
  eventRegistry: typeof eventRegistry;
  eventShapes: typeof eventShapes;
  "eventTypes/test": typeof eventTypes_test;
  feedback: typeof feedback;
  feedbackRules: typeof feedbackRules;
  health: typeof health;
  helpers: typeof helpers;
  houseAuth: typeof houseAuth;
  houseCore: typeof houseCore;
  http: typeof http;
  institutes: typeof institutes;
  inviteCore: typeof inviteCore;
  invites: typeof invites;
  leads: typeof leads;
  limits: typeof limits;
  members: typeof members;
  purge: typeof purge;
  referral: typeof referral;
  referralHttp: typeof referralHttp;
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
  scoring: typeof scoring;
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
  staffRead: typeof staffRead;
  students: typeof students;
  team: typeof team;
  teamCore: typeof teamCore;
  teamHttp: typeof teamHttp;
  trustedOrigins: typeof trustedOrigins;
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
