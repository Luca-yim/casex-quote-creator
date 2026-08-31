import { quoteSchema, type Quote } from "@/types/quote";

/**
 * Outcome of validating a quote for submission.
 */
export interface QuoteValidationResult {
  /** True when the quote satisfies the submission schema. */
  valid: boolean;
  /** Field-path to human-readable message map from Zod. */
  errors: Record<string, string>;
  /** Flat list of required field paths that are missing or invalid. */
  missingRequiredFields: string[];
}

/**
 * Field paths that the readiness pill considers required for a quote
 * to be treated as complete enough for estimator review.
 */
const READINESS_REQUIRED_FIELDS: Array<keyof Quote> = [
  "customerName",
  "customerType",
  "vertical",
  "solution",
  "moduleTier",
  "contractYears",
  "hostingModel",
  "supportTier",
];

/**
 * Result of the readiness check used by the sidebar pill.
 */
export interface ReadinessResult {
  /** True when every required field is populated. */
  ready: boolean;
  /** Number of required fields that are populated. */
  completedCount: number;
  /** Total number of tracked required fields. */
  totalRequired: number;
  /** Field paths that are still missing or empty. */
  missing: string[];
}

/**
 * Validates a quote against the Zod submission schema and returns a
 * structured result suitable for rendering inline form errors.
 *
 * @param quote - The quote to validate.
 * @returns Validation result with errors keyed by field path.
 */
export function validateQuoteForSubmission(quote: Quote): QuoteValidationResult {
  const parseResult = quoteSchema.safeParse(quote);

  if (parseResult.success) {
    return {
      valid: true,
      errors: {},
      missingRequiredFields: [],
    };
  }

  const errors: Record<string, string> = {};
  const missingRequiredFields: string[] = [];

  for (const issue of parseResult.error.issues) {
    const path = issue.path.join(".");
    errors[path] = issue.message;
    missingRequiredFields.push(path);
  }

  return {
    valid: false,
    errors,
    missingRequiredFields,
  };
}

/**
 * Counts how many required fields are filled on a quote. This is used by
 * the readiness pill in the intake sidebar.
 *
 * @param quote - The quote to inspect.
 * @returns Readiness summary.
 */
export function readinessCheck(quote: Quote): ReadinessResult {
  const missing: string[] = [];
  let completedCount = 0;

  for (const field of READINESS_REQUIRED_FIELDS) {
    // "Other" verticals answer with free text instead of a catalog solution.
    const value =
      field === "solution" && quote.vertical === "other"
        ? quote.verticalOtherDetail
        : quote[field];
    const isFilled = isFieldFilled(value);

    if (isFilled) {
      completedCount++;
    } else {
      missing.push(field);
    }
  }

  return {
    ready: missing.length === 0,
    completedCount,
    totalRequired: READINESS_REQUIRED_FIELDS.length,
    missing,
  };
}

/**
 * Determines whether a single field value counts as "filled" for the
 * readiness check.
 */
function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  if (typeof value === "number" && Number.isNaN(value)) {
    return false;
  }

  return true;
}

