import { extractTextFromFile, submitEssay } from "./api.js";
import { STORAGE_KEYS } from "../shared/constants.js";
import type { FeedbackResponse } from "../shared/schema.js";
import { renderEssayMarkup } from "./lib/essayRenderer.js";
import { renderSidebarCards, renderSummary } from "./lib/sidebarRenderer.js";
import {
  activate,
  filterAnnotations,
  initialViewerState,
  setFunctionFilter,
  setLevelFilter,
  switchTab,
  type FunctionFilter,
  type LevelFilter,
  type FeedbackTab,
  type ViewerState,
} from "./lib/interactions.js";

const SAMPLE_ESSAY = `In modern consumer culture, brands do more than sell products - they sell identities.

Starbucks positions itself as a "third place" between home and work through deliberate language and store design.

This essay explores how corporate discourse constructs belonging and where that rhetoric breaks down when scrutinized against real labor practices.`;

const SUPPORTED_EXTENSIONS = [".txt", ".md", ".doc", ".docx", ".pdf"];

interface AppContext {
  state: ViewerState;
  feedback: FeedbackResponse | null;
  essayText: string;
}

function setStatus(element: HTMLElement | null, text: string, kind: "info" | "error" = "info"): void {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-error", kind === "error");
}

function readFeedbackFromStorage(): FeedbackResponse | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.latestFeedback);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FeedbackResponse;
  } catch {
    return null;
  }
}

function applyActiveState(activeId: number | null): void {
  document.querySelectorAll<HTMLElement>(
    ".hl, .annotation-pin, .feedback-card",
  ).forEach((node) => {
    node.classList.remove("is-active");
  });
  if (activeId === null) return;
  document.querySelectorAll<HTMLElement>(`[data-id="${activeId}"]`).forEach((node) => {
    node.classList.add("is-active");
  });
}

function bindCrossHighlight(ctx: AppContext): void {
  document.querySelectorAll<HTMLElement>(
    ".hl, .annotation-pin, .feedback-card",
  ).forEach((node) => {
    node.addEventListener("click", () => {
      const id = Number(node.dataset.id);
      if (!id) return;
      ctx.state = activate(ctx.state, id);
      applyActiveState(ctx.state.activeAnnotationId);
      const card = document.querySelector<HTMLElement>(
        `.feedback-card[data-id="${id}"]`,
      );
      const highlight = document.querySelector<HTMLElement>(
        `.hl[data-id="${id}"]`,
      );
      card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      highlight?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function renderFeedback(ctx: AppContext): void {
  if (!ctx.feedback) return;
  const essayBody = document.getElementById("essayBody");
  const feedbackCards = document.getElementById("feedbackCards");
  const tabsRoot = document.getElementById("feedbackTabs");
  const fnFiltersRoot = document.getElementById("functionFilters");
  const levelFiltersRoot = document.getElementById("levelFilters");

  const filtered = filterAnnotations(ctx.feedback.annotations, ctx.state);

  if (essayBody) {
    essayBody.innerHTML = renderEssayMarkup(ctx.feedback.essay.paragraphs, filtered);
  }
  if (feedbackCards) {
    feedbackCards.innerHTML =
      ctx.state.currentTab === "annotations"
        ? renderSidebarCards(filtered)
        : renderSummary(ctx.feedback.overall_feedback);
  }

  tabsRoot?.querySelectorAll<HTMLElement>(".fb-tab").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.tab === ctx.state.currentTab);
  });
  fnFiltersRoot?.querySelectorAll<HTMLElement>(".dim-pill").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.filter === ctx.state.functionFilter);
  });
  levelFiltersRoot?.querySelectorAll<HTMLElement>(".dim-pill").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.level === ctx.state.levelFilter);
  });

  bindCrossHighlight(ctx);
  applyActiveState(ctx.state.activeAnnotationId);
}

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function setDropzoneFilename(filename: string | null): void {
  const dropZone = document.getElementById("dropZone");
  const filenameEl = document.getElementById("dropZoneFilename");
  if (!dropZone || !filenameEl) return;
  if (!filename) {
    filenameEl.textContent = "";
    filenameEl.classList.add("is-hidden");
    dropZone.classList.remove("is-loaded");
    return;
  }
  filenameEl.textContent = `Loaded: ${filename}`;
  filenameEl.classList.remove("is-hidden");
  dropZone.classList.add("is-loaded");
}

async function loadFileIntoContext(
  file: File,
  ctx: AppContext,
  statusEl: HTMLElement | null,
): Promise<void> {
  if (!isSupportedFile(file)) {
    setStatus(statusEl, "Unsupported file type. Use .txt, .md, .doc, .docx, or .pdf.", "error");
    return;
  }

  setStatus(statusEl, `Reading file: ${file.name}...`);
  try {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      ctx.essayText = (await file.text()).trim();
    } else {
      const result = await extractTextFromFile(file);
      ctx.essayText = result.essay_text;
    }
    if (!ctx.essayText) {
      setStatus(statusEl, "File parsed but no text was extracted.", "error");
      setDropzoneFilename(null);
      return;
    }
    setDropzoneFilename(file.name);
    setStatus(statusEl, `Loaded ${file.name}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read file.";
    setStatus(statusEl, message, "error");
    setDropzoneFilename(null);
  }
}

function setupDropzone(
  ctx: AppContext,
  statusEl: HTMLElement | null,
  fileInput: HTMLInputElement | null,
): void {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  const onDragEnter = (event: DragEvent): void => {
    event.preventDefault();
    dropZone.classList.add("is-dragover");
  };
  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    dropZone.classList.add("is-dragover");
  };
  const onDragLeave = (event: DragEvent): void => {
    event.preventDefault();
    if (event.target === dropZone) {
      dropZone.classList.remove("is-dragover");
    }
  };
  const onDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault();
    dropZone.classList.remove("is-dragover");
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (fileInput) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
      } catch {
        // some browsers may not support assigning files; ignore safely
      }
    }
    await loadFileIntoContext(file, ctx, statusEl);
  };

  dropZone.addEventListener("dragenter", onDragEnter);
  dropZone.addEventListener("dragover", onDragOver);
  dropZone.addEventListener("dragleave", onDragLeave);
  dropZone.addEventListener("drop", (event) => {
    void onDrop(event);
  });

  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput?.click();
    }
  });
}

function setupAppPage(): void {
  const fileInput = document.getElementById("essayFile") as HTMLInputElement | null;
  const useSampleBtn = document.getElementById("useSampleBtn");
  const submitBtn = document.getElementById("submitBtn");
  const newSubmissionBtn = document.getElementById("newSubmissionBtn");
  const statusEl = document.getElementById("submitStatus");
  const inputPanel = document.getElementById("inputPanel");
  const viewerShell = document.getElementById("viewerShell");
  const tabsRoot = document.getElementById("feedbackTabs");
  const fnFiltersRoot = document.getElementById("functionFilters");
  const levelFiltersRoot = document.getElementById("levelFilters");

  const ctx: AppContext = {
    state: { ...initialViewerState },
    feedback: readFeedbackFromStorage(),
    essayText: sessionStorage.getItem(STORAGE_KEYS.submittedEssayText) ?? "",
  };

  if (ctx.feedback) {
    inputPanel?.classList.add("is-hidden");
    viewerShell?.classList.remove("is-hidden");
    renderFeedback(ctx);
  }

  setupDropzone(ctx, statusEl, fileInput);

  fileInput?.addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await loadFileIntoContext(file, ctx, statusEl);
  });

  useSampleBtn?.addEventListener("click", () => {
    ctx.essayText = SAMPLE_ESSAY;
    setDropzoneFilename("sample-essay.txt");
    setStatus(statusEl, "Sample essay loaded.");
  });

  submitBtn?.addEventListener("click", async () => {
    const essayText = ctx.essayText.trim();
    if (!essayText) {
      setStatus(statusEl, "Please drop a file or load the sample essay first.", "error");
      return;
    }

    setStatus(statusEl, "Generating feedback... please wait.");
    sessionStorage.setItem(STORAGE_KEYS.submittedEssayText, essayText);
    try {
      const feedback = await submitEssay(essayText);
      sessionStorage.setItem(STORAGE_KEYS.latestFeedback, JSON.stringify(feedback));
      ctx.state = { ...initialViewerState };
      ctx.feedback = feedback;
      inputPanel?.classList.add("is-hidden");
      viewerShell?.classList.remove("is-hidden");
      renderFeedback(ctx);
      setStatus(statusEl, "Feedback generated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setStatus(statusEl, message, "error");
    }
  });

  newSubmissionBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(STORAGE_KEYS.latestFeedback);
    ctx.feedback = null;
    ctx.state = { ...initialViewerState };
    ctx.essayText = "";
    setDropzoneFilename(null);
    if (fileInput) {
      fileInput.value = "";
    }
    viewerShell?.classList.add("is-hidden");
    inputPanel?.classList.remove("is-hidden");
    setStatus(statusEl, "Ready for a new submission.");
  });

  fnFiltersRoot?.querySelectorAll<HTMLElement>(".dim-pill").forEach((node) => {
    node.addEventListener("click", () => {
      const value = node.dataset.filter as FunctionFilter | undefined;
      if (!value) return;
      ctx.state = setFunctionFilter(ctx.state, value);
      renderFeedback(ctx);
    });
  });

  levelFiltersRoot?.querySelectorAll<HTMLElement>(".dim-pill").forEach((node) => {
    node.addEventListener("click", () => {
      const value = node.dataset.level as LevelFilter | undefined;
      if (!value) return;
      ctx.state = setLevelFilter(ctx.state, value);
      renderFeedback(ctx);
    });
  });

  tabsRoot?.querySelectorAll<HTMLElement>(".fb-tab").forEach((node) => {
    node.addEventListener("click", () => {
      const value = node.dataset.tab as FeedbackTab | undefined;
      if (!value) return;
      ctx.state = switchTab(ctx.state, value);
      renderFeedback(ctx);
    });
  });
}

function bootstrap(): void {
  if (document.body.dataset.page === "app") {
    setupAppPage();
  }
}

bootstrap();
