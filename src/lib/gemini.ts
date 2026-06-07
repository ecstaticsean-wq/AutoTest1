import { GoogleGenAI } from "@google/genai";
import type { GenerateRequestBody } from "@/types/generate";

export const GEMINI_MODEL = "gemini-2.5-flash";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT =
  "당신은 한국 이커머스 셀러를 돕는 마케팅 카피라이터입니다. " +
  "반드시 JSON 객체로만 응답하세요. 다른 설명이나 코드블록 표시 없이 JSON만 출력하세요. " +
  "실제 개인정보나 고객 데이터를 포함하지 마세요 (이 도구는 상품 정보 기반 콘텐츠 생성 전용입니다).";

function buildInstructionText(input: GenerateRequestBody): string {
  const { productName, representativeSiteUrl, myStoreUrl } = input;

  return (
    `${SYSTEM_PROMPT}\n\n` +
    `상품명: ${productName}\n` +
    `대표판매사이트 URL: ${representativeSiteUrl}\n` +
    `내 판매페이지 URL: ${myStoreUrl}\n\n` +
    `다음 정보를 바탕으로 아래 5가지를 JSON으로 작성해주세요. 각 항목은 뻔하고 일반적인 광고 문구가 아니라, ` +
    `상품명과 대표판매사이트에서 짐작할 수 있는 구체적인 특징(맛, 용도, 사용 장면, 계절감 등)을 실제로 녹여낸 ` +
    `구체적이고 생생한 글이어야 합니다.\n\n` +
    `1. targetAudience: 상품명을 분석해 주요 구매층이 누구인지 1~2문장으로 설명\n` +
    `2. threadsPost: targetAudience에 맞는 톤의 쓰레드(Threads)용 글. ` +
    `**반드시 친근한 반말체**(예: "~야", "~지", "~거든", "~잖아" 같은 캐주얼하고 다정한 말투)로, ` +
    `마치 친한 친구에게 추천하듯 자연스럽게 작성. 반드시 대표판매사이트 URL(${representativeSiteUrl})을 포함\n` +
    `3. instagramPost: targetAudience에 맞는 톤의 인스타그램용 글. ` +
    `**반드시 강한 후킹이 있는 첫 문장**(궁금증을 유발하거나 공감을 이끄는 한 줄)으로 시작하고, ` +
    `**전체 분량은 200자 내외**로 간결하게 작성. 필요하면 어울리는 해시태그를 2~3개 포함\n` +
    `4. blogPost: targetAudience에 맞는 톤의 블로그 글. ` +
    `**하루 방문자 10만 명 이상인 파워블로거의 말투**(친근하면서도 신뢰감 있는 후기/체험담 톤, ` +
    `소제목과 줄바꿈으로 가독성 있게 구성, 솔직한 사용 경험을 들려주는 듯한 흐름)를 참고해 작성. ` +
    `반드시 내 판매페이지 URL(${myStoreUrl})을 포함\n` +
    `5. imageDescription: blogPost와 어울리는 연출이미지 1장에 대한 설명을 이미지 생성 도구(예: DALL-E, Midjourney)에 붙여넣을 수 있는 프롬프트 형태로 작성\n\n` +
    `JSON 형식: {"targetAudience": "...", "threadsPost": "...", "instagramPost": "...", "blogPost": "...", "imageDescription": "..."}`
  );
}

/** 이미지 없는 텍스트 전용 요청 */
export function buildGenerateContents(input: GenerateRequestBody) {
  return [
    {
      role: "user",
      parts: [{ text: buildInstructionText(input) }],
    },
  ];
}

/** 이미지 포함 요청: inlineData (base64) */
export function buildGenerateContentsWithImage(
  input: GenerateRequestBody,
  imageBase64: string,
  imageMimeType: string
) {
  return [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        },
        {
          text:
            buildInstructionText(input) +
            "\n\n위에 첨부된 판매 이미지도 참고하여 상품의 시각적 특징(색상, 포장, 분위기 등)을 글에 녹여주세요.",
        },
      ],
    },
  ];
}
