import "server-only";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { GEMINI_MODEL } from "@/lib/gemini";

// Returns a Gemini AI instance using the user's own key (if registered),
// falling back to the service key. The service key has a 20 req/day limit.
export async function getGeminiForUser(userId: string): Promise<GoogleGenAI> {
  const geminiKey = await db.userGeminiKey.findUnique({
    where: { userId },
    select: { encryptedApiKey: true },
  });

  if (geminiKey) {
    const apiKey = decrypt(geminiKey.encryptedApiKey);
    return new GoogleGenAI({ apiKey });
  }

  const serviceKey = process.env.GEMINI_API_KEY;
  if (!serviceKey) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다");

  return new GoogleGenAI({ apiKey: serviceKey });
}

export { GEMINI_MODEL };
