import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import { buildThreadsPostContents, GEMINI_MODEL } from "@/lib/gemini";
import { getGeminiForUser } from "@/lib/gemini-for-user";
import { getSession } from "@/lib/session";
import {
  isThreadsGenerateResponse,
  type GenerateErrorBody,
  type ThreadsGenerateRequest,
  type ThreadsGenerateResponse,
} from "@/types/generate";

export const runtime = "nodejs";

const TIMEOUT_MS = 60_000;
const OVERLOAD_RETRY_DELAYS_MS = [1_500, 4_000];

function errorResponse(status: number, error: string, retryable: boolean) {
  return NextResponse.json<GenerateErrorBody>({ error, retryable }, { status });
}

function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return errorResponse(401, "로그인이 필요합니다", false);
  }

  let body: Partial<ThreadsGenerateRequest>;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "요청 형식이 올바르지 않습니다.", false);
  }

  if (!body.productName?.trim()) {
    return errorResponse(400, "상품명을 입력해주세요.", false);
  }
  if (!body.salesUrl?.trim()) {
    return errorResponse(400, "판매URL을 입력해주세요.", false);
  }

  const input: ThreadsGenerateRequest = {
    productName: body.productName.trim(),
    salesUrl: body.salesUrl.trim(),
    userId: session.userId,
  };

  const contents = buildThreadsPostContents(input);

  let geminiAi;
  try {
    geminiAi = await getGeminiForUser(session.userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini API 초기화 실패";
    return errorResponse(500, msg, false);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await geminiAi.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            responseMimeType: "application/json",
            abortSignal: controller.signal,
          },
        });
        break;
      } catch (err) {
        const isOverloaded = err instanceof ApiError && err.status === 503;
        if (!isOverloaded || attempt >= OVERLOAD_RETRY_DELAYS_MS.length) throw err;
        await sleep(OVERLOAD_RETRY_DELAYS_MS[attempt]);
      }
    }

    const text = response.text;
    if (!text) {
      return errorResponse(500, "AI 응답을 받지 못했습니다. 다시 시도해주세요.", true);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonText(text));
    } catch {
      return errorResponse(500, "AI 응답을 처리하는 중 문제가 발생했습니다.", true);
    }

    if (!isThreadsGenerateResponse(parsed)) {
      return errorResponse(500, "AI 응답 형식이 올바르지 않습니다.", true);
    }

    return NextResponse.json<ThreadsGenerateResponse>(parsed);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return errorResponse(502, "Gemini API 키가 유효하지 않습니다.", false);
      }
      if (err.status === 429) {
        return errorResponse(502, "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", true);
      }
      if (err.status === 503) {
        return errorResponse(502, "Gemini 서버가 일시적으로 응답하지 못하고 있습니다. 잠시 후 다시 시도해주세요.", true);
      }
      return errorResponse(502, "AI 서비스 오류가 발생했습니다.", true);
    }
    if (err instanceof Error && err.name === "AbortError") {
      return errorResponse(504, "요청 시간이 초과되었습니다.", true);
    }
    console.error("[generate] unknown error", err);
    return errorResponse(500, "알 수 없는 오류가 발생했습니다.", true);
  } finally {
    clearTimeout(timeoutId);
  }
}
