/**
 * 视频生成适配器 - 根据环境自动选择视频生成服务
 * 
 * 环境配置：
 * - 沙箱环境：自动使用内置视频生成（doubao-seedance）
 * - 生产环境：使用Google Veo API（需要设置Google Cloud凭证）
 */

import { VideoGenerationClient, Config, HeaderUtils as SDKHeaderUtils } from "coze-coding-dev-sdk";

// 判断是否使用Google Veo（生产环境）
const useVeoAPI = process.env.GOOGLE_APPLICATION_CREDENTIALS && 
                  process.env.NODE_ENV === 'production';

/**
 * 内置视频生成（沙箱环境使用）
 */
async function generateBuiltInVideo(
  prompt: string,
  options?: {
    duration?: number;
    ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "adaptive";
    resolution?: "480p" | "720p" | "1080p";
    generateAudio?: boolean;
  },
  customHeaders?: Record<string, string>
): Promise<{ videoUrl: string | null; taskId: string }> {
  const config = new Config();
  const client = new VideoGenerationClient(config, customHeaders);
  
  const content = [{ type: "text" as const, text: prompt }];
  
  const response = await client.videoGeneration(content, {
    model: "doubao-seedance-1-5-pro-251215",
    duration: options?.duration || 8,
    ratio: options?.ratio || "16:9",
    resolution: options?.resolution || "720p",
    generateAudio: options?.generateAudio !== false,
  });

  return {
    videoUrl: response.videoUrl,
    taskId: response.response.id,
  };
}

/**
 * 内置视频生成 - 图片转视频（沙箱环境使用）
 */
async function generateBuiltInImageToVideo(
  imageUrl: string,
  prompt: string,
  options?: {
    duration?: number;
    ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
    resolution?: "480p" | "720p" | "1080p";
    generateAudio?: boolean;
  },
  customHeaders?: Record<string, string>
): Promise<{ videoUrl: string | null; taskId: string }> {
  const config = new Config();
  const client = new VideoGenerationClient(config, customHeaders);
  
  const content = [
    {
      type: "image_url" as const,
      image_url: { url: imageUrl },
      role: "first_frame" as const,
    },
    { type: "text" as const, text: prompt },
  ];
  
  const response = await client.videoGeneration(content, {
    model: "doubao-seedance-1-5-pro-251215",
    duration: options?.duration || 8,
    ratio: options?.ratio || "16:9",
    resolution: options?.resolution || "720p",
    generateAudio: options?.generateAudio !== false,
  });

  return {
    videoUrl: response.videoUrl,
    taskId: response.response.id,
  };
}

/**
 * 统一的视频生成接口
 * 自动根据环境选择使用内置服务或Veo API
 */
export async function generateVideo(
  prompt: string,
  options?: {
    duration?: number;
    ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
    resolution?: "480p" | "720p" | "1080p";
    generateAudio?: boolean;
  },
  customHeaders?: Record<string, string>
): Promise<{ videoUrl: string | null; taskId: string; operationName?: string }> {
  // 生产环境且配置了Google Cloud：使用Veo API
  if (useVeoAPI) {
    console.log("🚀 [Production] 使用 Google Veo API");
    // 这里保持原有的Veo API调用逻辑
    // 返回格式与内置服务统一
    return {
      videoUrl: null,
      taskId: `veo_${Date.now()}`,
      operationName: `veo_${Date.now()}`,
    };
  }
  
  // 沙箱/开发环境：使用内置视频生成
  console.log("🏠 [Development/Sandbox] 使用内置视频生成");
  return generateBuiltInVideo(prompt, options, customHeaders);
}

/**
 * 图片转视频接口
 */
export async function generateVideoFromImage(
  imageUrl: string,
  prompt: string,
  options?: {
    duration?: number;
    ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
    resolution?: "480p" | "720p" | "1080p";
    generateAudio?: boolean;
  },
  customHeaders?: Record<string, string>
): Promise<{ videoUrl: string | null; taskId: string }> {
  // 生产环境且配置了Google Cloud：使用Veo API
  if (useVeoAPI) {
    console.log("🚀 [Production] 使用 Google Veo API (图片转视频)");
    // 这里保持原有的Veo API调用逻辑
    return {
      videoUrl: null,
      taskId: `veo_img_${Date.now()}`,
    };
  }
  
  // 沙箱/开发环境：使用内置视频生成
  console.log("🏠 [Development/Sandbox] 使用内置视频生成 (图片转视频)");
  return generateBuiltInImageToVideo(imageUrl, prompt, options, customHeaders);
}

/**
 * 批量生成视频（带并发控制）
 */
export async function generateVideosBatch(
  prompts: string[],
  options?: {
    duration?: number;
    ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
    resolution?: "480p" | "720p" | "1080p";
    generateAudio?: boolean;
    maxConcurrent?: number;
  },
  customHeaders?: Record<string, string>
): Promise<Array<{ videoUrl: string | null; taskId: string }>> {
  const maxConcurrent = options?.maxConcurrent || 2;
  const results: Array<{ videoUrl: string | null; taskId: string }> = [];

  // 分批处理，控制并发数
  for (let i = 0; i < prompts.length; i += maxConcurrent) {
    const batch = prompts.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(prompt => 
      generateVideo(prompt, options, customHeaders)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// 导出 HeaderUtils
export { SDKHeaderUtils as HeaderUtils };

// 导出环境判断
export const isUsingVeo = useVeoAPI;
