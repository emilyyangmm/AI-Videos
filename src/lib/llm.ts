/**
 * LLM API 调用辅助函数
 * 使用沙箱内置的 coze-coding-dev-sdk
 */

import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

/**
 * 创建LLM客户端
 * @param customHeaders 自定义请求头（从API请求中提取）
 */
export function createLLMClient(customHeaders?: Record<string, string>) {
  const config = new Config();
  return new LLMClient(config, customHeaders);
}

/**
 * 调用 LLM 生成内容（非流式）
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @param customHeaders 自定义请求头
 * @param options 可选配置
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  customHeaders?: Record<string, string>,
  options?: {
    temperature?: number;
    model?: string;
    thinking?: "enabled" | "disabled";
  }
): Promise<string> {
  const client = createLLMClient(customHeaders);
  
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  const response = await client.invoke(messages, {
    temperature: options?.temperature || 0.7,
    model: options?.model || "doubao-seed-1-8-251228",
    thinking: options?.thinking || "disabled",
  });

  return response.content;
}

/**
 * 调用 LLM 生成内容（流式）
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @param customHeaders 自定义请求头
 * @param onChunk 每个chunk的回调
 * @param options 可选配置
 */
export async function streamLLM(
  systemPrompt: string,
  userPrompt: string,
  customHeaders: Record<string, string> | undefined,
  onChunk: (chunk: string) => void,
  options?: {
    temperature?: number;
    model?: string;
    thinking?: "enabled" | "disabled";
  }
): Promise<string> {
  const client = createLLMClient(customHeaders);
  
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  const stream = client.stream(messages, {
    temperature: options?.temperature || 0.7,
    model: options?.model || "doubao-seed-1-8-251228",
    thinking: options?.thinking || "disabled",
  });

  let fullContent = "";
  for await (const chunk of stream) {
    if (chunk.content) {
      const text = chunk.content.toString();
      fullContent += text;
      onChunk(text);
    }
  }

  return fullContent;
}

/**
 * 构建聊天格式的 prompt
 * 将 system prompt 和 user prompt 合并为一个 prompt
 */
export function buildChatPrompt(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}\n\n${userPrompt}`;
}

// 导出 HeaderUtils 供API路由使用
export { HeaderUtils };
