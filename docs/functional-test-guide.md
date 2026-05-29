# LLED / Essay Feedback MVP — Functional Test Guide

This document describes what should be verified from a **functional and behavioral** perspective: real inputs, real API endpoints, and real page behavior. It does not include unit or integration test designs that depend on mocks or stubs.

---

## 1. Feature Scope

| Capability | Description |
|------|------|
| Static app and home page | After opening the app, users can see the main interface and interactive areas, such as the paste area, upload area, and submit button. |
| File upload and extraction | Supported file types can be uploaded, and the server returns the extracted text and filename. |
| Essay submission and feedback | After submitting the essay text, users receive structured feedback that is displayed on the page. |
| Reading and interaction | Text highlights, sidebar cards, filters, tabs, click synchronization, and scrolling work correctly. |
| Errors and messages | For invalid input or server errors, users see a clear message instead of a blank screen or no response. |

---

## 2. Functional Test Case Matrix

### 2.1 File Upload and Text Extraction (`POST /api/extract-text` + Frontend Display)

| ID | Feature | Action / Input | Expected Result |
|----|--------|-------------|----------|
| F-EXT-01 | TXT support | Upload a small `.txt` file with English/Chinese text and line breaks. | The API succeeds; the page shows extracted text matching the file content; the filename is correct. |
| F-EXT-02 | Markdown support | Upload a `.md` file. | Same as above; extracted text is readable. |
| F-EXT-03 | DOCX support | Upload a real `.docx` file. | Visible text is extracted, with no unusable level of garbling. |
| F-EXT-04 | DOC support | Upload a `.doc` file if a sample is available. | The body text is extracted, or a clear error message is returned. |
| F-EXT-05 | PDF support | Upload a text-based PDF. | The main body text is extracted. |
| F-EXT-06 | Unsupported file rejection | Upload unsupported extensions such as `.png` or `.zip`. | The API fails; the frontend displays the error returned by the server. |
| F-EXT-07 | No file selected | Trigger upload without selecting a file, if the UI allows it. | Behavior matches the product design, such as disabling the button or showing a prompt. |
| F-EXT-08 | Oversized file | Upload a file larger than the server limit, such as >10MB. | The request fails with a readable error; status code or wording only needs to match the current deployment. |

---

### 2.2 Essay Submission and AI Feedback (`POST /api/essay-feedback` + Frontend Display)

**Prerequisite:** A valid `OPENAI_API_KEY` is configured, along with any required settings such as `OPENAI_MODEL`, and the environment can access OpenAI.

| ID | Feature | Action / Input | Expected Result |
|----|--------|-------------|----------|
| F-FB-01 | Paste submission | Paste a multi-paragraph English/Chinese short text into the page, separated by blank lines, and submit it. | The request succeeds; the sidebar shows summary and annotation items; all overall feedback fields are complete and readable. |
| F-FB-02 | Submit after upload | Upload a TXT/DOCX/PDF file first, then submit. | The flow behaves the same as the paste path and completes the feedback process. |
| F-FB-03 | Structured result | Any successful feedback response. | The response includes `essay.paragraphs`, `annotations`, and `overall_feedback`; the frontend can render highlights and cards. |
| F-FB-04 | Empty body | Submit with no content or whitespace only. | The request fails with a message equivalent to "essay_text cannot be empty." |
| F-FB-05 | Missing or invalid key/configuration | The deployment environment has no key or an invalid key. | The request fails; the frontend displays the error message. |
| F-FB-06 | Network or service failure | Disconnect the network or simulate an upstream timeout if needed. | An error message is displayed and the page does not crash. |
| F-FB-07 | Retry behavior | If a transient failure occurs, submit the same text again. | The user can send another request and either receive a result or see a clear error; no assertion is required for internal retry counts. |

---

### 2.3 Reader and Browser Interactions

| ID | Feature | Action | Expected Result |
|----|--------|------|----------|
| F-UI-01 | Highlights and cards | After successful feedback, click a text highlight or a sidebar card. | The corresponding item becomes active and the view scrolls appropriately. |
| F-UI-02 | Function filter | Switch filters such as Content, Interpersonal, and Organization. | Only annotations matching the selected filter are shown, or the empty state is clear. |
| F-UI-03 | Level filter | Switch filters such as Text, Section, and Clause. | Behavior matches the selected filter. |
| F-UI-04 | Sidebar tabs | Switch between summary and list tabs. | The content area changes correctly. |
| F-UI-05 | Refresh and session behavior | Refresh the page or re-enter the app, depending on whether persistence is expected. | Behavior matches the current implementation, such as whether `sessionStorage` preserves the state. |

---

### 2.4 Routing and Entry Points

| ID | Feature | Action | Expected Result |
|----|--------|------|----------|
| F-RT-01 | Root path | Visit `/`. | The main application page loads. |
| F-RT-02 | Frontend assets | Confirm that page styles and scripts finish loading. | No 404s cause core scripts to fail; there are no blocking console errors. |

---

## 3. Manual Smoke Checklist (Minimum Acceptance)

Run the following steps in a **real environment**, either local or deployed:

- [ ] Start the app, open the home page, and confirm the interface is complete.  
- [ ] Upload one supported file type and confirm that the body text appears in the editing/display area.  
- [ ] Paste multi-paragraph text and submit it with a valid key; confirm that feedback, highlights, and sidebar content appear.  
- [ ] Complete at least one round of filtering and click synchronization.  
- [ ] Intentionally submit an empty body or upload an unsupported format, and confirm that an error message appears.  
- [ ] Optional: submit with no key or an invalid key and confirm that the error is visible.  

---

## 4. Automated Functional Testing (Optional)

If using Playwright or similar tools for **end-to-end** automation, it is recommended to test only against a **real running service** and a **real-key test environment**, or a shared staging environment agreed upon by the team. Test cases can map directly to sections 2 and 3. This document does not require mocking the network or the model.

---

## 5. Sample Data Recommendations (Real Files, Not Stub Data)

Prepare the following for manual or E2E testing:

| Sample | Purpose |
|------|------|
| Short TXT file with multiple paragraphs and blank lines | F-EXT-01, F-FB-01 |
| Small DOCX and text-based PDF | F-EXT-03, F-EXT-05 |
| A short course-related essay | Full F-FB-02 flow |

---

## 6. Document Maintenance

- When the product adds file types, fields, or UI behaviors, add rows to section 2 and update the section 3 checklist.  
- Server limits, such as 10MB, should follow the actual configuration. Acceptance should be based on the current deployment behavior.

---

*Note: This document is a functional testing checklist. It is unrelated to unit tests for code modules or mock strategies.*
