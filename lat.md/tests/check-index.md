# Check Index Tests

This file was generated from `@lat` backlinks in test code; each section names the test that checks it.

## Detects missing index file

Checked by `tests/cases.test.ts`: error-missing-index › reports missing index file with snippet.

## Detects missing subdirectory index file

Checked by `tests/cases.test.ts`: error-missing-subdir-index › reports missing index file in subdirectory.

## Detects non-markdown file

Checked by `tests/cases.test.ts`: error-non-md-file › reports non-.md file as error.

## Detects stale index entry

Checked by `tests/cases.test.ts`: error-stale-index › reports entry that does not exist on disk.

## Detects stale subdirectory index entry

Checked by `tests/cases.test.ts`: error-stale-subdir-index › reports stale entry in subdirectory index.

## Non-markdown files excluded from index listing

Checked by `tests/cases.test.ts`: error-non-md-file › does not include non-.md file in missing index entries.

## Passes with valid index

Checked by `tests/cases.test.ts`: valid-index › passes when index lists all entries.

## Passes with valid subdirectory index

Checked by `tests/cases.test.ts`: valid-subdir-index › passes when subdirectory index lists all entries.
