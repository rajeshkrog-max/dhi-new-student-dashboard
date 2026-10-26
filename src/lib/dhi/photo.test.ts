import assert from "node:assert/strict";
import { test } from "node:test";
import { PHOTO_MAX_SIDE, fitWithin, isPhotoType } from "./photo.ts";

test("spec house/0014: a picture keeps its shape and its long side is at most 1280", () => {
  assert.deepEqual(fitWithin(4000, 3000, PHOTO_MAX_SIDE), { width: 1280, height: 960 });
  assert.deepEqual(fitWithin(3000, 4000, PHOTO_MAX_SIDE), { width: 960, height: 1280 });
  assert.deepEqual(fitWithin(1280, 720, PHOTO_MAX_SIDE), { width: 1280, height: 720 });
});

test("spec house/0014: a small picture is never made larger, and a thin one never becomes zero", () => {
  assert.deepEqual(fitWithin(300, 200, PHOTO_MAX_SIDE), { width: 300, height: 200 });
  assert.deepEqual(fitWithin(5000, 2, PHOTO_MAX_SIDE), { width: 1280, height: 1 });
});

test("spec house/0014: a size that is not a picture has no shape", () => {
  assert.deepEqual(fitWithin(0, 100, PHOTO_MAX_SIDE), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(Number.NaN, 100, PHOTO_MAX_SIDE), { width: 0, height: 0 });
});

test("spec house/0014: only a JPEG, a PNG and a WebP are pictures", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(isPhotoType(type), true, type);
  for (const type of ["image/gif", "image/svg+xml", "text/html", "application/pdf", ""]) assert.equal(isPhotoType(type), false, type);
});
