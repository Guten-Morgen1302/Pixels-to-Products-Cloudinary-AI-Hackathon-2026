// Every route answers { ok:false, code, message } on failure. No codeless 500s (Eng: Code quality).
export type ErrorCode =
  | "BUDGET_PAUSED"
  | "TOO_LARGE"
  | "NOT_A_PHOTO"
  | "NO_PRODUCT"
  | "PROCESSING"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "GEN_QUOTA"
  | "GEN_REFUSED"
  | "GEN_TIMEOUT"
  | "GEN_FAILED"
  | "WHITE_FAILED"
  | "INTERNAL";

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 400) {
    super(message);
  }
}

export const MESSAGES: Record<ErrorCode, string> = {
  BUDGET_PAUSED: "Live AI paused to save credits. Library stages still work.",
  TOO_LARGE: "Photos up to 10 MB, please.",
  NOT_A_PHOTO: "That file isn't a photo.",
  NO_PRODUCT: "Couldn't find a clear product. Retake on a plain surface with space around it.",
  PROCESSING: "Taking longer than usual.",
  NOT_FOUND: "We couldn't find that photo. Try uploading again.",
  FORBIDDEN: "That photo belongs to another session.",
  BAD_REQUEST: "Something was missing from that request.",
  GEN_QUOTA: "Live AI paused to save credits. Library stages still work.",
  GEN_REFUSED: "That prompt was declined. Try describing a place.",
  GEN_TIMEOUT: "This model didn't respond.",
  GEN_FAILED: "This model didn't respond.",
  WHITE_FAILED: "Couldn't make a clean white Amazon image. Try a photo with more space around the product.",
  INTERNAL: "Something went wrong on our side. Try again.",
};
