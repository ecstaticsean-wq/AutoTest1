import { GoogleGenAI } from "@google/genai";
import type { ThreadsGenerateRequest } from "@/types/generate";

export const GEMINI_MODEL = "gemini-2.5-flash-lite";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT =
  "당신은 한국 Threads 마케팅 전문가입니다. " +
  "반드시 JSON 객체로만 응답하세요. 다른 설명이나 코드블록 표시 없이 JSON만 출력하세요. " +
  "생성된 글은 단순 광고가 아닌 소통과 참여를 유도하는 방향이어야 합니다.";

const FORMAT_DESCRIPTIONS: Record<string, string> = {
  question:
    "질문형: 팔로워들이 댓글로 의견을 남기고 싶게 만드는 열린 질문으로 마무리되는 글",
  debate:
    "논쟁형: 팔로워들 사이에서 '나는 이렇게 생각해'라는 반응을 이끌어내는 이슈 제기 형식의 글",
  opinion:
    "의견형: 작성자가 강한 개인 의견을 피력하고, 팔로워들이 동의/반대를 표명하고 싶게 만드는 글",
  experience:
    "경험형: 상품을 실제로 써본 듯한 생생한 체험담 형식으로 자연스럽게 구매 욕구를 자극하는 글",
};

function buildThreadsInstruction(input: ThreadsGenerateRequest): string {
  const { productName, salesUrl } = input;

  return (
    `${SYSTEM_PROMPT}\n\n` +
    `상품명: ${productName}\n` +
    `판매URL: ${salesUrl}\n\n` +
    `위 상품에 대해 Threads 소통형 포스트를 작성해주세요.\n\n` +
    `**포맷 선택 기준**: 아래 4가지 중 이 상품에 가장 잘 맞는 포맷을 AI가 자동으로 선택하세요:\n` +
    Object.entries(FORMAT_DESCRIPTIONS)
      .map(([key, desc]) => `- ${key}: ${desc}`)
      .join("\n") +
    `\n\n` +
    `**작성 규칙**:\n` +
    `1. 반드시 친근한 반말체로 작성 (예: "~야", "~지", "~거든", "~잖아")\n` +
    `2. 첫 줄은 무조건 스크롤을 멈추게 만드는 후킹 문장\n` +
    `3. 본문은 3~5줄로 간결하게 (Threads 최적 분량)\n` +
    `4. 마지막은 반드시 댓글을 유도하는 문장이나 질문으로 마무리\n` +
    `5. 판매URL(${salesUrl})을 자연스럽게 포함\n` +
    `6. 해시태그는 2~3개만, 핵심 키워드 위주로\n\n` +
    `JSON 형식: {\n` +
    `  "postFormat": "question|debate|opinion|experience 중 하나",\n` +
    `  "postText": "실제 Threads 글 전체 내용",\n` +
    `  "engagementHook": "이 포스트가 댓글을 유도하는 핵심 이유 1문장"\n` +
    `}`
  );
}

export function buildThreadsPostContents(input: ThreadsGenerateRequest) {
  return [
    {
      role: "user",
      parts: [{ text: buildThreadsInstruction(input) }],
    },
  ];
}
