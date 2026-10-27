# For the Hinglish reader

Thank you for reading these. The house shows two parts in Hinglish when a student or a parent picks it: the Progress page (the Brain report) and the weekly parent page. Everything else is English for now.

## What to read

`docs/launch/words/hinglish.md`, about 100 lines in two sections. Each line starts with a code name in grey (for example `PATTERN_COPY.steady_rhythm.hi.text`); the words after it are what the screen shows. Values in braces such as {name} are filled in on the screen, and a number shows as 7. The English twin of each line is in `docs/launch/words/english.md` under the same section, with `en` in place of `hi`.

## What to check

1. **Natural:** does it read the way a student of 13 to 17, or their parent, talks, in Roman letters?
2. **Kind:** nothing may sound like a label or a rank (no "weak", "average", "bright", "kamzor", "tez"), a diagnosis (no illness words), a cause ("because you slept late") or a judgement of food or sleep.
3. **The same meaning as the English:** no line says more, or less, than its English twin.
4. **The helpline line** names Tele-MANAS 14416 and points to people, not to the app.

## How to send changes

Write the code name and the new words, for example:

> `LAMP_COPY.sadhana.hi.name`: Sadhana (unchanged)
> `UI.hi.connectionsTitle`: Aapke dinon ke beech ke rishte

Or mark the lines in a printed copy. The builder puts the changes in and runs the copy tests, which check that no ranking, clinical or cause word slips in. When the owner is happy, `BRAIN_WORDS_APPROVED` and `PARENT_WORDS_APPROVED` are switched on (owner gates 2 and 7).
