# LLED 200 Descriptive Report: Rubric Dimensions and Course Material Mapping (Draft)

> **Purpose**: For human review and editing. Aligned with the three functions (`content` / `interpersonal` / `organization`) and three levels (`text` / `section` / `clause_word`) in `src/backend/lib/prompts/prompt.md`.  
> **Note**: Each level in the prompt contains multiple detailed criteria, often described as about 12 checking dimensions. This mapping uses the **9 combinations (3 x 3)** as the main structure, with **one most accurate teaching reference file** for each combination.

The filenames below all come from teaching materials in the course materials folder. Assignment draft, final instruction, and grading rubric files are not used.

---

## 1. Dimensions in prompt.md (Quick Reference)

| function (`prompt`) | Meaning |
|---------------------|------|
| content | Knowledge representation: information progression, definitions, process types, nominalization, etc. |
| interpersonal | Interpersonal meaning: stance, evidence and reporting, hedging, citation conventions, etc. |
| organization | Discourse organization: macro-structure, cohesion, Theme/New, punctuation, etc. |

| level (`prompt`) | Meaning |
|------------------|------|
| text | Whole-text level |
| section | Paragraph / rhetorical stage level |
| clause_word | Clause, phrase, and word level |

---

## 2. Mapping Overview (9 Combinations -> Recommended Study File)

### 2.1 Content · Text level

**Prompt focus (summary)**: Whether the whole text builds knowledge at the discourse level; whether information progresses from general to specific; whether the title previews key content.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `LLED200 Academic Writing_ Representing Content V.5 2025.docx` | Best matches whole-text knowledge building and information development for the Content function. |

---

### 2.2 Content · Section level

**Prompt focus (summary)**: Whether paragraphs move from general to specific; whether new concepts are clearly defined; whether ordering is logical, such as time, cause, or comparison; whether examples, data, and sources are integrated into paragraphs.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `LLED200 Week 4 Definitions 2025.pptx` | Best matches paragraph-level concept definition and general-to-specific development. |

---

### 2.3 Content · Clause & word level

**Prompt focus (summary)**: Noun groups, process types such as relational and material processes, definition patterns such as Token + relational process + Value, nominalization, and prepositional phrases for reason, purpose, time, and location.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `LLED200 Academic Writing_ Representing Content V.5 2025.docx` | Best matches process types, participants, circumstances, noun groups, and clause-level content representation. |

---

### 2.4 Interpersonal · Text level

**Prompt focus (summary)**: Whether the academic stance is clear and appropriate; whether the text presents a disciplinary-appropriate critical perspective.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `Unit 3  Interpersonal Positioning & Citation v.03 July 9 2015.docx` | Best matches whole-text academic stance and interpersonal positioning. |

---

### 2.5 Interpersonal · Section level

**Prompt focus (summary)**: Whether claims are reliable and appropriately evaluated; whether the writer guides the reader; whether authoritative sources support claims; whether different perspectives are introduced when needed.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `Unit 3  Interpersonal Positioning & Citation v.03 July 9 2015.docx` | Best matches paragraph-level reliable claims, source use, and reader guidance. |

---

### 2.6 Interpersonal · Clause & word level

**Prompt focus (summary)**: Hedging, boosters, objective tone, verb tense and reporting verbs, APA-style citation conventions, and formal academic vocabulary.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `Hedging & Boosting in Research Writing in the Field of Artificial Intelligence.docx` | Best matches hedging, boosting, and stance strength at the clause level. |

---

### 2.7 Organization · Text level

**Prompt focus (summary)**: Whether the title previews key ideas; whether the introduction previews the structure; whether the conclusion, if present, revisits key ideas; whether references match in-text citations.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `Description_Model_Holocene Epoch_LLED 200_outline & clause analysis.docx` | Best matches Descriptive Report title, introduction, body structure, outline, and clause analysis. |

---

### 2.8 Organization · Section level

**Prompt focus (summary)**: Whether sentences flow coherently; whether transitions are clear; whether paragraphs maintain focus; whether cohesive devices help track key ideas; whether abstract concepts are expanded into concrete explanations.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `Unit 6 Logic and Cohesion TEACHERS NOTES  v.03 July 9.docx` | Best matches paragraph and sentence-level logic, transitions, and cohesion. |

---

### 2.9 Organization · Clause & word level

**Prompt focus (summary)**: Theme, meaning known information early in the sentence, and New, meaning new information later in the sentence; placement of background information; standard academic English clause patterns; punctuation and readability.

| Priority | Filename | Suggested section / Notes (editable) |
|--------|--------|--------------------------------|
| 1 | `LLED200 Task Theme-New Organization in Academic Writing.docx` | Best matches Theme-New organization, clause information placement, and sentence-level organization. |

---

## 3. Editable Review Items (Checklist)

- [ ] Locate each course material by filename in the course materials folder. If there are duplicate filenames, note how to distinguish them.
- [ ] Add the **specific page number / slide number / activity number** for each combination.
- [ ] Add or remove entries if a weekly handout has an updated filename.
- [ ] Decide the **fixed English label** to use in JSON `citations.label`, so model output remains consistent.
- [ ] Confirm that each combination keeps only one most accurate reference file.
- [ ] Confirm that all references are teaching materials, not assignment drafts, final instructions, or rubrics.

---

## 4. Revision History

| Date | Editor | Summary |
|------|--------|------|
| Draft | | Initial draft generated, pending review |
