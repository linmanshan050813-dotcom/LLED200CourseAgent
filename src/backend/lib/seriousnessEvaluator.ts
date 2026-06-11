import type {
  Annotation,
  FeedbackSeriousness,
  RubricCategory,
  StudentPriority,
} from "../../shared/schema.js";

export interface SeriousnessEvaluation {
  rubric_category?: RubricCategory;
  seriousness: FeedbackSeriousness;
  reason: string;
  student_priority: StudentPriority;
}

export interface SeriousnessEvaluatorContext {
  essayWordCount: number;
  paragraphCount: number;
}

interface RuleMatch {
  seriousness: FeedbackSeriousness;
  reason: string;
}

const SERIOUSNESS_RANK: Record<FeedbackSeriousness, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  "Extra high": 3,
};

const STUDENT_PRIORITY_BY_SERIOUSNESS: Record<FeedbackSeriousness, StudentPriority> =
  {
    Low: "Minor polish",
    Medium: "Useful improvement",
    High: "Important revision",
    "Extra high": "Must revise first",
  };

const PRESENTATION_PATTERN =
  /\b(formatting|word count|presentation|capitalization|punctuation|spacing|font|margin|minor grammar|minor apa|typo|concision|repetition|proofread)\b/i;

const EXTRA_HIGH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(definition (is )?(missing|absent|not (present|included|provided)|unclear|inaccurate|wrong|fundamentally|incorrect|incomplete definition required))\b/i,
    reason:
      "A required definition is missing, unclear, or fundamentally inaccurate, which threatens core assignment compliance.",
  },
  {
    pattern:
      /\b(missing (required )?(title|definition|description|references|reference list|reference section))\b/i,
    reason:
      "A required report stage (title, definition, description, or references) appears missing.",
  },
  {
    pattern:
      /\b(not (a )?descriptive report|does not read as descriptive|not organized as descriptive|explanatory|argumentative|opinion[- ]based|personal narrative|persuasive rather than descriptive)\b/i,
    reason:
      "The text may not meet the descriptive report genre requirement.",
  },
  {
    pattern:
      /\b(part\/whole|type\/subtype|part-whole|type-subtype|whole[- ]part|subtype relation)\b/i,
    reason:
      "The description stage may not follow required part/whole or type/subtype relations.",
  },
  {
    pattern:
      /\b(difficult to follow|hard to follow|cannot follow|confusing throughout|whole text (is )?(unclear|confusing))\b/i,
    reason: "Content is difficult to follow at the whole-text level.",
  },
  {
    pattern:
      /\b(references (are )?(missing|absent|not included|fabricated|made up|fake|no reference)|missing citations|not connected to (in-text )?citations|citation[s]? (not )?connected)\b/i,
    reason:
      "References or in-text citations may be missing, fabricated, or disconnected.",
  },
  {
    pattern:
      /\b(far (below|above|outside)|well (below|above)|outside).{0,30}(350|450|word (count|limit|range))\b/i,
    reason:
      "The assignment may fall far outside the required 350–450 word range.",
  },
  {
    pattern:
      /\b(inappropriate claim|unsupported claim presented as fact|overstate|fabricated source)\b/i,
    reason:
      "Interpersonal positioning issue threatens rubric compliance through inappropriate or unsupported claims.",
  },
];

const HIGH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(definition (exists|present|included) but|incomplete definition|definition could be clearer|definition lacks)\b/i,
    reason:
      "A definition exists but is incomplete or not fully developed for rubric expectations.",
  },
  {
    pattern:
      /\b(topic sentence (does not|doesn't|fails to) preview|does not preview (criteria|parts|subtypes|structure|order))\b/i,
    reason:
      "The topic sentence does not adequately preview criteria, parts, subtypes, or logical order.",
  },
  {
    pattern:
      /\b(not (clearly )?organized around (one )?(part|subtype|feature|aspect)|paragraph (lacks|missing) (clear )?focus)\b/i,
    reason:
      "A paragraph is not clearly organized around one part, subtype, or feature.",
  },
  {
    pattern:
      /\b(supporting details (are )?(weak|incomplete|missing|illogical)|weak evidence|insufficient detail)\b/i,
    reason: "Supporting details are weak, incomplete, or illogically ordered.",
  },
  {
    pattern:
      /\b(general[- ]to[- ]specific|general to specific).{0,40}(not maintained|broken|reversed|unclear)\b/i,
    reason: "General-to-specific order is not maintained.",
  },
  {
    pattern:
      /\b(too general|too vague|lacks (scientific|technical) detail|not enough (scientific|technical|specific) detail)\b/i,
    reason: "Description is too general, vague, or lacks enough scientific detail.",
  },
  {
    pattern:
      /\b(missing (academic )?terminology|missing nominalization|lacks abstraction|needs (more )?technical (language|terms))\b/i,
    reason:
      "Important academic terminology, abstraction, or nominalization may be missing.",
  },
  {
    pattern:
      /\b(citations (are )?(present but|incomplete|inconsistent|poorly integrated)|citation integration|apa (errors|issues).{0,30}(source (is )?still identifiable))\b/i,
    reason:
      "Citations are present but incomplete, inconsistent, or not well integrated.",
  },
  {
    pattern:
      /\b(clause[- ]level|sentence structure|theme\/new|theme-new).{0,50}(meaning|understanding|reader)\b/i,
    reason:
      "Clause-level organization affects meaning or reader understanding.",
  },
  {
    pattern:
      /\b(affects (the )?(whole )?paragraph|required stage|major rubric)\b/i,
    reason:
      "The issue affects a full paragraph, a required stage, or a major rubric outcome.",
  },
];

const MEDIUM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(weak transition|transitions (are )?(weak|unclear|missing)|logical connector|cohesion)\b/i,
    reason:
      "Transitions or cohesion need improvement but do not break assignment compliance.",
  },
  {
    pattern:
      /\b(awkward (phrasing|wording)|could be more academic|wording is too concrete|more abstract|more technical)\b/i,
    reason:
      "Academic style or phrasing could be improved without changing core meaning.",
  },
  {
    pattern:
      /\b(noun group|expand(ed)? noun|more precise (word|term|noun))\b/i,
    reason: "Noun groups or word choice could be more precise or academic.",
  },
  {
    pattern:
      /\b(overused|underused|slightly awkward).{0,30}(connector|linking|transition)\b/i,
    reason: "Logical connectors are overused, underused, or slightly awkward.",
  },
  {
    pattern:
      /\b(minor apa|apa (format|style)).{0,30}(identifiable|minor)\b/i,
    reason:
      "Minor APA issues where the source is still identifiable.",
  },
  {
    pattern:
      /\b(title (is )?(acceptable|could|should) (better|more|represent))\b/i,
    reason:
      "The title is acceptable but could better represent the defined term.",
  },
  {
    pattern:
      /\b(several sentences|multiple sentences|within the paragraph)\b/i,
    reason:
      "The issue affects several sentences but not the whole text or a required stage.",
  },
  {
    pattern:
      /\b(hedging|boosting|reporting verb|stance|tone).{0,40}(could|should|weak|strong)\b/i,
    reason:
      "Interpersonal positioning could be strengthened for clearer academic stance.",
  },
];

const LOW_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(minor grammar|grammar (error|issue)|does not affect meaning)\b/i,
    reason: "Minor grammar issue that does not affect meaning.",
  },
  {
    pattern:
      /\b(minor punctuation|comma splice|apostrophe|capitalization)\b/i,
    reason: "Minor punctuation or capitalization issue.",
  },
  {
    pattern:
      /\b(one word|word choice|more precise but|meaning is (still )?clear)\b/i,
    reason:
      "A word could be more precise, but the current meaning is clear.",
  },
  {
    pattern:
      /\b(minor formatting|spacing|indent|font)\b/i,
    reason: "Minor formatting issue.",
  },
  {
    pattern:
      /\b(repetition|concision|wordy|redundant)\b/i,
    reason: "Minor repetition or concision issue.",
  },
  {
    pattern:
      /\b(style polish|polish only|minor improvement)\b/i,
    reason:
      "Feedback mainly improves style rather than content, organization, or compliance.",
  },
];

const MEANING_AFFECTING_PATTERN =
  /\b(meaning|understanding|confus(e|ing)|unclear|misread|reader (cannot|can't|may not))\b/i;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function annotationText(annotation: Annotation): string {
  return [
    annotation.issue_type,
    annotation.feedback,
    annotation.revision_guidance,
    annotation.evidence.reason,
  ]
    .join(" ")
    .toLowerCase();
}

function matchesPresentationIssue(annotation: Annotation, text: string): boolean {
  if (PRESENTATION_PATTERN.test(text)) {
    return true;
  }
  return (
    annotation.severity === "low" &&
    (annotation.function !== "content" ||
      /\b(format|presentation|punctuation|grammar|apa)\b/i.test(text))
  );
}

export function mapRubricCategory(annotation: Annotation): RubricCategory | undefined {
  if (annotation.function === "interpersonal") {
    return undefined;
  }

  const text = annotationText(annotation);

  if (matchesPresentationIssue(annotation, text)) {
    return "Presentation";
  }

  if (annotation.function === "content") {
    return "Content";
  }

  switch (annotation.level) {
    case "text":
      return "Organization: Whole text";
    case "section":
      return "Organization: Paragraph level";
    case "clause_word":
      return "Organization: Clause level";
    default:
      return "Organization: Paragraph level";
  }
}

function matchRules(
  text: string,
  rules: Array<{ pattern: RegExp; reason: string }>,
  level: FeedbackSeriousness,
): RuleMatch | null {
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return { seriousness: level, reason: rule.reason };
    }
  }
  return null;
}

function pickHighest(matches: RuleMatch[]): RuleMatch | null {
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((best, current) =>
    SERIOUSNESS_RANK[current.seriousness] > SERIOUSNESS_RANK[best.seriousness]
      ? current
      : best,
  );
}

function baselineInterpersonalSeriousness(
  annotation: Annotation,
  text: string,
): RuleMatch {
  const { severity } = annotation;

  if (
    /\b(missing|fabricated|fake|no citation|not cited|unsupported claim)\b/i.test(
      text,
    )
  ) {
    return {
      seriousness: "Extra high",
      reason:
        "Issue involving missing, fabricated, or inappropriate claims/citations.",
    };
  }

  return {
    seriousness: severity === "high" ? "High" : "Medium",
    reason:
      "Issue affecting academic stance, hedging, or source use.",
  };
}

function baselineSeriousness(
  annotation: Annotation,
  category: RubricCategory | undefined,
  context: SeriousnessEvaluatorContext,
  text: string,
): RuleMatch {
  if (annotation.function === "interpersonal" || !category) {
    return baselineInterpersonalSeriousness(annotation, text);
  }

  const { severity, level } = annotation;

  switch (category) {
    case "Content": {
      if (level === "text") {
        return {
          seriousness: severity === "low" ? "High" : "Extra high",
          reason:
            "Content issue at whole-text level; likely to affect core assignment compliance.",
        };
      }
      if (level === "section") {
        return {
          seriousness: severity === "high" ? "High" : "Medium",
          reason:
            "Content issue at paragraph level under a major rubric category.",
        };
      }
      return {
        seriousness: severity === "high" ? "High" : "Medium",
        reason: "Content issue at clause/word level under a major rubric category.",
      };
    }

    case "Organization: Whole text":
      return {
        seriousness:
          severity === "high" || level === "text" ? "High" : "Medium",
        reason:
          "Whole-text organization issue; likely to affect a major rubric outcome.",
      };

    case "Organization: Paragraph level":
      return {
        seriousness: severity === "high" ? "High" : "Medium",
        reason: "Paragraph-level organization issue.",
      };

    case "Organization: Clause level": {
      const meaningAffected = MEANING_AFFECTING_PATTERN.test(text);
      if (meaningAffected && severity !== "low") {
        return {
          seriousness: severity === "high" ? "High" : "Medium",
          reason:
            "Clause-level organization affects how clearly the reader understands the text.",
        };
      }
      return {
        seriousness: severity === "high" ? "Medium" : "Low",
        reason:
          "Clause-level organization issue with limited impact on overall compliance.",
      };
    }

    case "Presentation": {
      if (
        context.essayWordCount > 0 &&
        (context.essayWordCount < 300 || context.essayWordCount > 500) &&
        level === "text"
      ) {
        return {
          seriousness: "Extra high",
          reason:
            "Presentation/word-count issue may affect assignment compliance outside 350–450 words.",
        };
      }
      return {
        seriousness: severity === "high" ? "Medium" : "Low",
        reason:
          "Presentation or polish issue with limited impact on assignment compliance.",
      };
    }

    default:
      return {
        seriousness: "Medium",
        reason: "General revision issue mapped by rubric category defaults.",
      };
  }
}

function collectPatternMatches(text: string, annotation: Annotation): RuleMatch[] {
  const matches: RuleMatch[] = [];

  const extraHigh = matchRules(text, EXTRA_HIGH_PATTERNS, "Extra high");
  if (extraHigh) {
    matches.push(extraHigh);
  }

  const high = matchRules(text, HIGH_PATTERNS, "High");
  if (high) {
    matches.push(high);
  }

  const medium = matchRules(text, MEDIUM_PATTERNS, "Medium");
  if (medium) {
    matches.push(medium);
  }

  const low = matchRules(text, LOW_PATTERNS, "Low");
  if (low) {
    matches.push(low);
  }

  if (
    annotation.level === "text" &&
    annotation.function === "content" &&
    annotation.severity === "high"
  ) {
    matches.push({
      seriousness: "Extra high",
      reason:
        "Whole-text content issue with high model severity; likely to affect core assignment compliance.",
    });
  }

  if (
    annotation.level === "text" &&
    /\b(whole text|entire (essay|report|draft)|throughout)\b/i.test(text)
  ) {
    matches.push({
      seriousness: "Extra high",
      reason: "Issue affects the whole text rather than only one sentence.",
    });
  }

  return matches;
}

export function evaluateAnnotationSeriousness(
  annotation: Annotation,
  context: SeriousnessEvaluatorContext,
): SeriousnessEvaluation {
  const rubric_category = mapRubricCategory(annotation);
  const text = annotationText(annotation);
  const patternMatches = collectPatternMatches(text, annotation);
  const bestPattern = pickHighest(patternMatches);
  const baseline = baselineSeriousness(annotation, rubric_category, context, text);

  const chosen =
    bestPattern &&
    SERIOUSNESS_RANK[bestPattern.seriousness] >= SERIOUSNESS_RANK[baseline.seriousness]
      ? bestPattern
      : baseline;

  return {
    rubric_category,
    seriousness: chosen.seriousness,
    reason: chosen.reason,
    student_priority: STUDENT_PRIORITY_BY_SERIOUSNESS[chosen.seriousness],
  };
}

export function evaluateFeedbackSeriousness(
  annotations: Annotation[],
  essayText: string,
): Array<Annotation & SeriousnessEvaluation> {
  const context: SeriousnessEvaluatorContext = {
    essayWordCount: countWords(essayText),
    paragraphCount: essayText.trim() ? essayText.trim().split(/\n\s*\n/g).filter(Boolean).length : 0,
  };

  return annotations.map((annotation) => ({
    ...annotation,
    ...evaluateAnnotationSeriousness(annotation, context),
  }));
}

export function sortAnnotationsBySeriousness<T extends { seriousness: FeedbackSeriousness }>(
  annotations: T[],
): T[] {
  return [...annotations].sort(
    (a, b) => SERIOUSNESS_RANK[b.seriousness] - SERIOUSNESS_RANK[a.seriousness],
  );
}

export { SERIOUSNESS_RANK, STUDENT_PRIORITY_BY_SERIOUSNESS, countWords };
