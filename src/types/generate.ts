export type ThreadsPostFormat = "question" | "debate" | "opinion" | "experience";

export interface ThreadsGenerateRequest {
  productName: string;
  salesUrl: string;
  userId?: string;
}

export interface ThreadsGenerateResponse {
  postFormat: ThreadsPostFormat;
  postText: string;
  engagementHook: string;
}

export interface GenerateErrorBody {
  error: string;
  retryable: boolean;
}

export function isThreadsGenerateResponse(value: unknown): value is ThreadsGenerateResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.postFormat === "string" &&
    typeof v.postText === "string" &&
    typeof v.engagementHook === "string"
  );
}

// Legacy types kept for backwards compat with any remaining references
export interface GenerateRequestBody {
  productName: string;
  representativeSiteUrl: string;
  myStoreUrl: string;
}

export interface GenerateResponseBody {
  targetAudience: string;
  threadsPost: string;
  instagramPost: string;
  blogPost: string;
  imageDescription: string;
}

export function isGenerateResponseBody(value: unknown): value is GenerateResponseBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.targetAudience === "string" &&
    typeof v.threadsPost === "string" &&
    typeof v.instagramPost === "string" &&
    typeof v.blogPost === "string" &&
    typeof v.imageDescription === "string"
  );
}
