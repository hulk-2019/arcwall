import OpenAI from "openai";

// doubao client
export function getDoubaoAIClient() {
  const openai = new OpenAI({
    baseURL: process.env.ARK_API_BASE_URL,
    apiKey: process.env.ARK_API_KEY,
  });

  return openai;
}
