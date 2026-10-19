# 0005. Consent, privacy and access record for minors' house data (decision record)

Context, options and rationale for [the build spec](./index.md).

## Context

> ⚠️ Premise note: the strongest promise in the scope row, "verifiable parental consent for students under 18", is a legal standard this spec cannot meet by design alone. A school saying "the parent's written consent is on file" is a statement by a third party, not the parent's own act. The funnel's own specs flag the same gap for its guardian tick. This spec builds the record and the gate so that a stronger parent confirmation can be added without a rebuild, and it blocks any real student until the owner approves the words and a lawyer has answered the question.

**Workspace**: the shared backend (`packages/backend`), with a little house screen work. Scope: `docs/scope/house/platform.md`, row 4. Stack: Convex with `convex-test`, the entry function `requireMember` (house spec 0002), the event log (house spec 0004) and the funnel's consent machinery (`consentText.ts`, `consentTexts`, `consentHash`).

Students in the house are children in India. The Digital Personal Data Protection Act, 2023 treats a child's data specially: consent from a parent, no tracking or targeting of children, and rights to correct and erase. The house will hold exactly the kind of data that makes this matter: how a child feels (mood), what they eat, how they sleep, what they write, what they say to a study helper. The Master Spec sets the audience rules (full detail to the student, a summary to parents only if the student shares it, class totals of 10 or more to the school) and leaves "parent sharing default" as an open decision. House spec 0002 deliberately left three things to this row: the consent reason in the entry function, whether a DHI admin may read room content, and how `members` rows are erased. House spec 0004 left who may read events and how they are erased.

Nothing exists yet that stops a member reaching a room without consent, that records who looked at a child's data, or that lets a child or a parent take the data back. Until this row is built and its words approved, only made up people may be loaded on any deployment. If nothing is decided, every room row decides its own visibility and the Brain reads across rooms with no common wall.

## Options considered

### Option 1: One consent gate inside the entry function, one fixed access rule, a logged view helper, and an erase that follows the funnel's pattern (chosen)

Consent is checked in `requireMember`, so every call re checks it. The school records the parent's consent. Who may see what is one pure function used by every read. Views by anyone but the student go through a helper that records them. Export, withdrawal and erasure follow the funnel's designed pattern.

**Pros**:
- One place for consent and one wall for visibility, so no room can forget either.
- A change of consent or of age takes effect on the very next call.
- The same words, fingerprints and erase shape the funnel already uses, so there is little new to learn or to get wrong.
- Leaves room for a stronger parent confirmation later.

**Cons**:
- The school's statement is weaker than the parent's own act.
- Staff screens for named student data cannot be live, because a view must write a record.
- Every later room must register an eraser and exporter and call the rule.

### Option 2: Consent as part of Join, and rules left to each room

Make agreeing part of the Join step (no member exists without it), and let each room decide who may see its data.

**Pros**:
- Simpler first step: no "consent needed" state.

**Cons**:
- Changes the Join step already built and tested, and a parent record made later cannot unlock someone who is not yet a member.
- Eleven rooms would each invent a visibility rule, and the Brain would read across inconsistent walls.
- Nothing would record views.

### Option 3: The parent confirms directly (a link or code) from day one

Collect a parent email or phone in the class list, send a link or code, and record the parent's own confirmation.

**Pros**:
- The strongest proof, and the closest to verifiable parental consent.

**Cons**:
- Needs parents' contact details (more children's family data to protect), a way to send messages, and a parent screen, none of which exist.
- Delays the first pilot class, which already has consent forms on file at the school.

### Option 4: Student tick only, as in the funnel

A student under 18 ticks that a parent agreed, and nothing more is recorded.

**Pros**:
- Nothing new to build.

**Cons**:
- It is a statement by the child. The funnel's own specs say it may not be enough, and for the house, where the data is far more private, it is weaker still.

## Rationale

Option 1 fits the forces. The entry function already runs on every house call and spec 0002 planned consent as one more reason to refuse there, so putting the gate in it means nobody can reach a room by another route, and a withdrawal or an age correction takes effect at once. Keeping Join as built (against Option 2) avoids reworking a tested step, and lets a parent record made after joining unlock the student.

The parent consent method is the one place the engineer's pilot setting decided the answer: a class with consent forms on file at the school is best served by the school recording that fact, accountable by name and date, rather than by building parent contact and messaging (Option 3) before there is a pilot to learn from. A tick by the child (Option 4) adds no accountability. The record is a kind of consent record, so a parent link can later add a second kind without changing the gate.

The access rule follows who the data is about. Mood, meals, sleep, writing and chats are feelings and habits of children; a teacher helps with study and the school with results, so only academic results are named to staff, and wellbeing is shown to the school only as totals of 10 or more, so a number can never point at a child. A DHI admin manages people and never reads content, because the safest default for children's data is that the team that runs the platform cannot read it. Parent sharing starts off and belongs to the student, because the Master Spec recommends it and because a child's feelings should reach a parent only by the child's choice.

Recording every view, and showing the student its role and date, is what makes that wall real and checkable. It costs staff screens their live updating, which is a fair price for data about children. Retention and erasure follow the funnel's design (the student or the team on a parent's request, a 30 day block against gaming, receipts with counts only), with one addition for the house: a leaver's data is erased automatically a year after removal, so data is not held for years after a child leaves. The retention periods and the school's recording of consent still need a lawyer's word, which is why no real student enters before that check.
