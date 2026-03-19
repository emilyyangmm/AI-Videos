/**
 * LLM 适配器 - 直接调用 Google Gemini API
 * 
 * 使用方式：
 * 设置环境变量 GEMINI_API_KEY=你的密钥
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

/**
 * 统一的LLM调用接口 - 直接调用 Gemini API
 * 
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @param _customHeaders 未使用（保留参数兼容性）
 * @param _options 未使用（保留参数兼容性）
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  _customHeaders?: Record<string, string>,
  _options?: {
    temperature?: number;
    model?: string;
    thinking?: "enabled" | "disabled";
  }
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 环境变量未设置");
  }

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: fullPrompt,
            },
          ],
        },
      ],
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 调用失败: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini API 错误: ${data.error.message}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini API 返回空结果");
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * 流式LLM调用（Gemini 暂不支持流式，降级为非流式）
 */
export async function streamLLM(
  systemPrompt: string,
  userPrompt: string,
  _customHeaders: Record<string, string> | undefined,
  onChunk: (chunk: string) => void,
  _options?: {
    temperature?: number;
    model?: string;
    thinking?: "enabled" | "disabled";
  }
): Promise<string> {
  const result = await callLLM(systemPrompt, userPrompt);
  onChunk(result);
  return result;
}

/**
 * 构建聊天格式的 prompt
 */
export function buildChatPrompt(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}\n\n${userPrompt}`;
}

// HeaderUtils 占位（保持兼容性）
export const HeaderUtils = {
  extractForwardHeaders: (_headers: Headers) => ({}),
};

// 导出环境判断（供调试使用）
export const isUsingGemini = true;
