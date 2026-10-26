# 0016. DHI desk: real model, coins and answer cache

**Date**: 2026-10-20
**Status**: Built for chat and clarify (2026-10-24), the other kinds wait

## Summary

The DHI desk is a study helper. Each question costs coins from the student's wallet: chat 1, write 2, paper 2, mock 4, story 5, draw 8, clarify free. Coins are given to students each month by DHI admin and are never bought. When the same question comes again, the stored answer is returned for no coins and the model is not called. The model is not chosen yet, so the desk cannot answer live until it is.

## Requirements

**User stories**:
- As a student, I want to ask the desk a question, spend the right coins and see my thread after a reload.
- As a student with no coins, I want a plain refusal, not a model answer.
- As DHI, I want to set each month's allotment, and an institute admin must not be able to change it.

**Acceptance criteria**:
- **AC-1**: A student asks the desk a question and the right coins are taken for its kind. The thread is kept and reads back after a reload.
- **AC-2**: A student with too few coins is refused by the server. No model call is made.
- **AC-3**: A repeated question returns the stored answer for 0 coins and makes no model call.
- **AC-4**: Coins are given by DHI admin each month. No function lets a student buy coins.
- **AC-5**: Only DHI admin sets the monthly allotment. An institute admin cannot.
- **AC-6**: No counselor recording can be stored by the desk.
- **AC-7**: The desk sends the model only what the student typed, with no name, no class and no other student's data.

## Decision

**Chosen option**: Coins are allotted, never bought. A cache returns a stored answer for a repeated question. The model is not yet chosen, so the answer step is held.

**Implementation skills**: none yet.

**Progress (2026-10-20)**: by the owner's answer the desk shows a coming soon page with a vector drawing (`ui/coming-soon.tsx`) until a model is chosen. Wallets, the allotment and the cache are not built.

**Progress (2026-10-24)**: the owner supplied a model key (OpenAI) and asked for the answer step too, so the hold is lifted. Built: the wallet with a monthly allotment of 60 coins set by DHI admin (`desk.allot`), unused coins rolling over, saved talks, coin taking in the same step that stores a question, the answer cache (per institute, 90 days, never for a question with an email or phone number), the exam lock, the care answer for distress words (no model, no coins, nothing stored), and the gateway `deskAsk.ask` (model `gpt-4o-mini` unless `DESK_MODEL` says otherwise, 600 tokens at most, a 60 second limit, coins returned on any failure, a minute job for questions that never finished). Live kinds are chat (1 coin), clarify (free, 20 an hour) and write (2 coins; owner's answers of 2026-10-24: up to 1500 letters, and the desk coaches but never rewrites: what works, at most three things to improve each with a short example, then the student tries the rewrite; no marks or grade). A write turn is never cached, shares the exam lock, care check and hourly limit, and has its own instruction `WRITE_SYSTEM_PROMPT` (a draft). Paper (2 coins; owner's answer of 2026-10-24: practice questions on a topic) takes a topic of up to 600 letters and returns five short questions with no answers (`PAPER_SYSTEM_PROMPT`, a draft); the student asks about an answer afterwards with the free clarify, and a paper is never cached so each one is fresh. Mock (4 coins; owner's answer of 2026-10-24: a longer practice set, self checked) is the same as paper with ten questions, room for 1000 tokens instead of 600 (`maxTokensFor`), and `MOCK_SYSTEM_PROMPT`, a draft: no timer, no marks, no score, no answers. Story (5 coins; owner's answer of 2026-10-24: a study story from a topic, not a free story) takes a school topic and returns one short story, under 250 words, that teaches the idea through everyday Indian life, with no violence, romance, frightening scenes, real people or brands (`STORY_SYSTEM_PROMPT`, a draft that needs the owner's approval before real students). Draw (8 coins; owner's answer of 2026-10-24: simple study diagrams only, not a picture model) asks the text model for one SVG element. `cleanSvg` in `deskRules.ts` keeps it only if every tag and attribute is on a short list (shapes, text and markers; no script, style, image, foreignObject, link, event attribute, comment, entity other than amp, lt and gt, or address other than a same page `url(#id)`), it is one element of at most 12000 characters and 250 elements; anything else is a failure and the 8 coins go back. The answer is stored as the checked SVG and the screen shows it through an image tag, which never runs a script. `DRAW_SYSTEM_PROMPT` asks for no people or faces and at most 12 labels, and is a draft. The screen has six modes, "Ask a question", "Feedback on my writing", "Practice questions", "Longer practice set", "Study story" and "Diagram". Every kind is live. The screen is `src/components/dhi/desk/desk-real.tsx`. 32 tests in `desk.test.ts` use a stand in `fetch` that counts its calls. The key lives only in the deployment's `OPENAI_API_KEY`, and `DESK_LIVE` must be `true`. Set on development only. The words (`DESK_WORDS_APPROVED`) are drafts. The after session card and its Brain event are in spec 0018. DHI admin has a screen for the allotment (staff area, "DHI desk", `desk-section.tsx`, reading `desk.allotment`); an institute admin and a teacher do not see it.

## Rationale

Allotment keeps money out of students' hands and out of the first version. The cache keeps cost down and gives the same answer to the same question, which the scope asks for. Sending only the question protects student data.

## Feature design

**Data model sketch**:
- `deskWallets`: `memberId`, `balance`, `monthKey`.
- `deskThreads`: `memberId`, `title`, `createdAt`.
- `deskTurns`: `threadId`, `kind`, `question`, `answer`, `coinsSpent`, `cacheKey` (a hash of the normalised question and kind).
- `deskCache`: `cacheKey`, `answer`, `kind`, `createdAt`.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `desk.ask` | action | thread id, kind, question | the answer and coins left | student | `not_enough_coins`, `bad_kind`, `model_not_chosen` |
| `desk.allot` | mutation | member id, coins for the month | ok | DHI admin | `forbidden` |
| `desk.thread` | query | thread id | the turns | student | `not_found` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Coins taken | the price | the fixed price for the kind |
| Cache key | the key | hash of the question with its kind, normalised by the server |
| Model input | the question | the student's text only |

**Key invariants**:
- Balance never goes below zero.
- A cached answer costs 0 coins and no model call.
- The model never receives a name, class or another student's data.

**Security model**: students use their own wallet only. DHI admin allots coins. No counselor recording is stored.

**Critical test scenarios**:
- A repeated question costs 0 and makes no model call, verifies **AC-3**.
- A student with 0 coins is refused, verifies **AC-2**.
- An institute admin's allotment is refused, verifies **AC-5**.

## Build plan

1. Wallets, prices and DHI allotment (satisfies **AC-4**, **AC-5**).
2. Threads and turns with coin taking (satisfies **AC-1**, **AC-2**).
3. Cache and its zero cost path (satisfies **AC-3**).
4. Model call with the input rule (satisfies **AC-7**), held until a model is chosen.
5. Counselor recording guard (satisfies **AC-6**).

## Consequences

**Positive**: cache keeps the cost of repeated questions at zero and gives consistent answers.

**Negative / tradeoffs**: no live answers until the model is chosen. The cache may hold an answer that is out of date.

## Follow-up

- [x] Owner: choose the model. OpenAI, key supplied 2026-10-24 (default `gpt-4o-mini`, changeable with `DESK_MODEL`). The key was pasted into the chat, so rotate it before real students.
- [x] Owner: set the monthly coin allotment amount. 60 (owner, 2026-10-24).
- [x] Decide the cache expiry. 90 days, per institute (builder default, owner to confirm).
- [ ] Production: set `OPENAI_API_KEY` and `DESK_LIVE` there, only with the owner's yes. A minor's questions go to the model provider, so the legal check and the word approvals come first.
- [ ] Owner: confirm the care text (it names Tele-MANAS 14416) and what a minor may ask.
- [ ] Decide which of the Desk Design steps D1 to D6 fit this slice.

## Rationale

Options considered: coins bought with money (rejected, payment rules), coins allotted (chosen), and no coins at all (rejected, the scope prices each kind).

## Owner answers and review fixes (2026-10-20)

**Owner answers**: the desk is on hold until a model is chosen, so no answer step is built now. Unused coins roll over to the next month.

**Builder fixes from review**:
- Coins are reserved in a mutation before any model call and refunded if the call fails, so a race cannot spend them twice.
- The cache is checked before the balance, so a cache hit costs 0 even for a student with 0 coins.
- A cache is scoped per institute (recommended, owner to confirm). A turn with an attachment is never cached.
- Attachments are allowed only for PDF and image files.
- Clarify, the free kind, has a rate limit.
- `desk.thread` checks that the caller owns the thread.
- Tests use a fake model adapter that counts its calls, so the cache and coin rules can be proven without a model.
- Open questions: the monthly allotment amount, the cache expiry, the month boundary (India time), and what a minor may ask or be shown.
