# Review packs

Generated from the repository so they never drift from the site's text.

| File | What it makes | Command |
|---|---|---|
| `legal-drafts-pdf.cjs` | One PDF of the Terms, Privacy policy and Educator waiver in English and Traditional Chinese, every bracketed note for the lawyer highlighted and numbered 1 to 34 (the numbers match the brief for counsel) | `NODE_PATH=$(npm root -g) node docs/review/legal-drafts-pdf.cjs out.pdf` |
| `chinese-review-pack.py` | A spreadsheet of every piece of site and legal text, English beside Traditional Chinese, with columns for a native proofreader's corrections, status and comments, plus a glossary of key terms and how consistently each is used | `python3 docs/review/chinese-review-pack.py out.xlsx` |

The brief for counsel is a shared document (not in the repository). It lists the 26 questions, what the site does today, the data map, and all 34 notes.
