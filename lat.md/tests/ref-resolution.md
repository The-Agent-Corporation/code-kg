# Ref Resolution Tests

This file was generated from `@lat` backlinks in test code; each section names the test that checks it.

## Ambiguous short ref in code

Checked by `tests/cases.test.ts`: error-ambiguous-short-ref › check code-refs reports ambiguous code ref with candidate paths.

## Ambiguous short ref in md

Checked by `tests/cases.test.ts`: error-ambiguous-short-ref › check md reports ambiguous wiki link with candidate paths.

## Ambiguous short ref unique section

Checked by `tests/cases.test.ts`: error-ambiguous-short-ref › check md suggests fix when section exists in only one file.

## Bare heading in code is error

Checked by `tests/cases.test.ts`: error-bare-heading-ref › check code-refs rejects bare heading name.

## Bare heading in md is error

Checked by `tests/cases.test.ts`: error-bare-heading-ref › check md rejects bare heading name as wiki link.

## Full ref findSections resolves

Checked by `tests/cases.test.ts`: full-ref › findSections finds section by full path.

## Full ref passes check code-refs

Checked by `tests/cases.test.ts`: full-ref › check code-refs passes with fully qualified code refs.

## Full ref passes check md

Checked by `tests/cases.test.ts`: full-ref › check md passes with fully qualified wiki links.

## Full ref refs finds code references

Checked by `tests/cases.test.ts`: full-ref › findRefs with full query finds code refs.

## Full ref refs finds md references

Checked by `tests/cases.test.ts`: full-ref › findRefs with full query finds md wiki links.

## Local section syntax in md is error

Checked by `tests/cases.test.ts`: error-bare-heading-ref › check md rejects #Heading local section syntax.

## Nested in-file refs pass

Checked by `tests/cases.test.ts`: valid-nested-refs › check md passes with fully qualified nested section refs.

## Nonexistent file ref in md is error

Checked by `tests/cases.test.ts`: error-bare-heading-ref › check md rejects link to nonexistent file.

## Nonexistent leaf in nested ref is error

Checked by `tests/cases.test.ts`: error-bad-nested-refs › check md rejects ref with nonexistent leaf heading.

## Short ref findSections resolves

Checked by `tests/cases.test.ts`: short-ref › findSections resolves short ref to full section.

## Short ref passes check code-refs

Checked by `tests/cases.test.ts`: short-ref › check code-refs passes with short code refs to subdir files.

## Short ref passes check md

Checked by `tests/cases.test.ts`: short-ref › check md passes with short wiki links to subdir files.

## Short ref refs finds code references

Checked by `tests/cases.test.ts`: short-ref › findRefs with short query finds code refs.

## Short ref refs finds md references

Checked by `tests/cases.test.ts`: short-ref › findRefs with short query finds md wiki links.

## Skipped intermediate in ref is error

Checked by `tests/cases.test.ts`: error-bad-nested-refs › check md rejects ref that skips intermediate section.

## Valid code ref with file prefix passes

Checked by `tests/cases.test.ts`: error-bare-heading-ref › check code-refs passes valid file#Heading ref.

## Wrong nesting order in ref is error

Checked by `tests/cases.test.ts`: error-bad-nested-refs › check md rejects ref with wrong nesting order.
