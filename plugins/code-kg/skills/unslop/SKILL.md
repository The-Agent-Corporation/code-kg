---
name: unslop
description: Edit text you wrote for humans (commit messages, PR titles/bodies, docs, comments, replies) to remove AI tells and restore a clear human voice. Apply before committing, posting, or sending.
---

# Unslop

Scan → rewrite → add voice → self-audit.

## Cut these tells

- Puffery and promotional adjectives
- Chatbot filler ("happy to help", "great question")
- Em-dash habit; prefer periods or commas
- Bold-label list spam and emoji decoration
- Hedge stacks ("might potentially possibly")
- Abstract metaphor nouns used as fake precision (substrate, wedge, north star)

## Add voice

- State a concrete opinion when it helps
- Vary sentence length
- Prefer active voice and plain words
- Be specific to this repo/change

## Code-KG usage

Run unslop over:

- `code-kg work` close reasons that will appear in PRs
- PR title/body that includes evidence tables
- New `lat.md` prose before `code-kg check`

Do not rewrite prose you did not author unless asked.
