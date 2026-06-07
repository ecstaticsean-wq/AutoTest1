import { NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import {
  ai,
  GEMINI_MODEL,
  buildGenerateContents,
  buildGenerateContentsWithImage,
} from "@/lib/gemini";
import { validateGenerateInput } from "@/lib/validation";
import {
  isGenerateResponseBody,
  type GenerateErrorBody,
  type GenerateRequestBody,
  type GenerateResponseBody,
} from "@/types/generate";

export const runtime = "nodejs";

const TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function errorResponse(status: number, error: string, retryable: boolean) {
  return NextResponse.json<GenerateErrorBody>({ error, retryable }, { status });
}

function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

const OVERLOAD_RETRY_DELAYS_MS = [1_500, 4_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithOverloadRetry(
  params: Parameters<typeof ai.models.generateContent>[0]
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const isOverloaded = err instanceof ApiError && err.status === 503;
      if (!isOverloaded || attempt >= OVERLOAD_RETRY_DELAYS_MS.length) {
        throw err;
      }
      console.error(`[generate] Gemini overloaded, retrying in ${OVERLOAD_RETRY_DELAYS_MS[attempt]}ms`);
      await sleep(OVERLOAD_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function parseRequestBody(
  request: Request
): Promise<{ body: Partial<GenerateRequestBody>; imageBase64?: string; imageMimeType?: string } | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return null;
    }
    const productName = formData.get("productName");
    const representativeSiteUrl = formData.get("representativeSiteUrl");
    const myStoreUrl = formData.get("myStoreUrl");
    const imageFile = formData.get("image");

    const body: Partial<GenerateRequestBody> = {
      productName: typeof productName === "string" ? productName : undefined,
      representativeSiteUrl:
        typeof representativeSiteUrl === "string" ? representativeSiteUrl : undefined,
      myStoreUrl: typeof myStoreUrl === "string" ? myStoreUrl : undefined,
    };

    if (imageFile instanceof File && imageFile.size > 0) {
      if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
        return null;
      }
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return null;
      }
      const arrayBuffer = await imageFile.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
      return { body, imageBase64, imageMimeType: imageFile.type };
    }

    return { body };
  }

  // JSON fallback
  try {
    const body = await request.json();
    return { body: body as Partial<GenerateRequestBody> };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return errorResponse(
      500,
      "Gemini API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요.",
      false
    );
  }

  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return errorResponse(400, "요청 형식이 올바르지 않습니다.", false);
  }

  const { body, imageBase64, imageMimeType } = parsed;

  const validationError = validateGenerateInput(body);
  if (validationError) {
    return errorResponse(400, validationError, false);
  }

  const validBody = body as GenerateRequestBody;

  const contents =
    imageBase64 && imageMimeType
      ? buildGenerateContentsWithImage(validBody, imageBase64, imageMimeType)
      : buildGenerateContents(validBody);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await generateWithOverloadRetry({
      model: GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: "application/json",
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text) {
      return errorResponse(500, "AI 응답을 받지 못했습니다. 다시 시도해주세요.", true);
    }

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(extractJsonText(text));
    } catch {
      return errorResponse(500, "AI 응답을 처리하는 중 문제가 발생했습니다. 다시 시도해주세요.", true);
    }

    if (!isGenerateResponseBody(parsedResult)) {
      return errorResponse(500, "AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.", true);
    }

    return NextResponse.json<GenerateResponseBody>(parsedResult);
  } catch (err) {
    if (err instanceof ApiError) {
      console.error("[generate] Gemini ApiError", err.status, err.message);
      if (err.status === 401 || err.status === 403) {
        return errorResponse(502, "Gemini API 키가 유효하지 않습니다. .env.local 파일을 확인해주세요.", false);
      }
      if (err.status === 429) {
        return errorResponse(502, "요청이 많아 잠시 후 다시 시도해주세요.", true);
      }
      if (err.status === 503) {
        return errorResponse(
          502,
          "Gemini AI 서버가 현재 요청량이 많아 일시적으로 응답하지 못하고 있습니다 (앱 문제가 아니에요). 1~2분 후 '다시 시도'를 눌러주세요.",
          true
        );
      }
      if (err.status >= 500) {
        return errorResponse(502, "Gemini 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.", true);
      }
      return errorResponse(502, "AI 서비스 호출 중 오류가 발생했습니다. 다시 시도해주세요.", true);
    }
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[generate] timeout / abort");
      return errorResponse(504, "요청 시간이 초과되었습니다. 다시 시도해주세요.", true);
    }
    console.error("[generate] unknown error", err);
    return errorResponse(500, "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.", true);
  } finally {
    clearTimeout(timeoutId);
  }
}
