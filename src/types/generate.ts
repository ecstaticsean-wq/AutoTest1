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

export interface GenerateErrorBody {
  error: string;
  retryable: boolean;
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
