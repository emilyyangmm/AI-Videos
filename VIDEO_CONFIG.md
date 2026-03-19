# 视频生成配置说明

## 环境自动适配

本项目已实现 **环境感知的视频生成适配器**，会自动根据环境选择合适的视频生成服务：

### 🔹 沙箱/开发环境
- **自动使用**：内置视频生成（豆包Seedance）
- **无需配置**：开箱即用
- **适用场景**：本地开发、沙箱测试

### 🔹 生产环境
- **自动使用**：Google Veo API
- **需要配置**：设置Google Cloud凭证
- **适用场景**：线上部署、正式生产

---

## 功能对比

| 功能 | 内置视频生成（沙箱） | Google Veo（生产） |
|------|-------------------|-------------------|
| **需要API密钥** | ❌ 不需要 | ✅ 需要Google Cloud凭证 |
| **需要外网访问** | ❌ 不需要 | ✅ 需要 |
| **文本生成视频** | ✅ 支持 | ✅ 支持 |
| **图片生成视频** | ✅ 支持（首帧+末帧） | ✅ 支持（参考图） |
| **自动生成音频** | ✅ 支持（对白+音效+音乐） | ✅ 支持 |
| **时长** | 4-12秒 | 4-8秒 |
| **分辨率** | 480p/720p/1080p | 720p/1080p/4k |
| **宽高比** | 16:9/9:16/1:1等 | 16:9/9:16 |
| **模型** | doubao-seedance-1-5-pro | veo-3.1-generate-001 |

---

## 配置方式

### 方式1：沙箱/开发环境（默认）
无需任何配置，代码会自动检测并使用内置视频生成。

```bash
# 无需设置任何环境变量
# 代码会自动使用内置的豆包Seedance模型
```

**优势：**
- ✅ 无需外网访问（沙箱环境完美运行）
- ✅ 无需配置API密钥
- ✅ 支持自动生成音频（对白、音效、背景音乐）
- ✅ 支持图片转视频

### 方式2：生产环境（使用Veo）

#### 步骤1：获取Google Cloud凭证
1. 创建Google Cloud项目
2. 启用Vertex AI API
3. 创建服务账号并下载JSON密钥文件
4. 配置Veo API权限

#### 步骤2：设置环境变量

**本地开发/测试：**
```bash
# .env.local 文件
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GCS_OUTPUT_URI=gs://your-bucket/outputs/
NODE_ENV=production
```

**生产部署：**
```bash
# 在部署平台设置环境变量
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
NODE_ENV=production
```

---

## 环境判断逻辑

代码会按以下逻辑判断使用哪个视频生成服务：

```typescript
// 当同时满足以下条件时，使用 Veo API
const useVeoAPI = process.env.GOOGLE_APPLICATION_CREDENTIALS && 
                  process.env.NODE_ENV === 'production';
```

**判断规则：**
- ✅ 有 `GOOGLE_APPLICATION_CREDENTIALS` 且 `NODE_ENV=production` → 使用Veo
- ❌ 其他情况 → 使用内置视频生成

---

## 使用示例

### 1. 文本生成视频

```typescript
import { generateVideo, HeaderUtils } from "@/lib/video";

// 在API路由中
export async function POST(request: NextRequest) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  
  const result = await generateVideo(
    "一只橘色的小猫在阳光下打盹，镜头缓慢推进",
    {
      duration: 8,
      ratio: "16:9",
      resolution: "720p",
      generateAudio: true,
    },
    customHeaders
  );
  
  return NextResponse.json({
    videoUrl: result.videoUrl,
    taskId: result.taskId,
  });
}
```

### 2. 图片生成视频

```typescript
import { generateVideoFromImage, HeaderUtils } from "@/lib/video";

const result = await generateVideoFromImage(
  "https://example.com/image.jpg",  // 图片URL
  "镜头缓慢推进，人物微笑",          // 运动描述
  {
    duration: 5,
    ratio: "16:9",
    resolution: "720p",
  },
  customHeaders
);
```

### 3. 批量生成视频

```typescript
import { generateVideosBatch, HeaderUtils } from "@/lib/video";

const prompts = [
  "日落时分的海边",
  "城市夜景",
  "森林中的小路",
];

const results = await generateVideosBatch(
  prompts,
  {
    duration: 5,
    ratio: "16:9",
    maxConcurrent: 2,  // 控制并发数
  },
  customHeaders
);

// results 是数组，每个元素包含 videoUrl 和 taskId
```

---

## API端点

### 测试端点
**GET /api/video/test** - 测试内置视频生成

**响应示例：**
```json
{
  "success": true,
  "message": "视频生成成功（沙箱内置服务）",
  "videoUrl": "https://coze-coding-project.tos.coze.site/.../video.mp4",
  "taskId": "cgt-20260319113124-85bvw"
}
```

### 自定义生成
**POST /api/video/test** - 使用自定义提示词生成视频

**请求体：**
```json
{
  "prompt": "你的视频描述",
  "duration": 8,
  "ratio": "16:9",
  "resolution": "720p"
}
```

---

## 内置视频生成特性

### 音频生成（自动）
内置服务会自动生成：
- **对白**：根据提示词中的引号内容生成（如：'他说："你好"'）
- **音效**：根据场景自动匹配（如：风声、水声）
- **背景音乐**：根据氛围自动生成

**示例：**
```typescript
// 提示词中包含对话
await generateVideo(
  '一个男孩对女孩说："你真漂亮"',
  { generateAudio: true }
);
// 生成的视频会包含真实的对白声音
```

### 图片转视频（首帧控制）
```typescript
await generateVideoFromImage(
  "https://example.com/start.jpg",
  "镜头缓慢推进，人物转身",
  { duration: 5 }
);
```

### 智能时长选择
```typescript
// 让模型自动选择最佳时长（4-12秒）
await generateVideo(
  "一个完整的场景",
  { duration: -1 }  // -1 表示智能选择
);
```

### 智能宽高比选择
```typescript
// 让模型自动选择最佳宽高比（文本生视频专用）
await generateVideo(
  "横屏风景画面",
  { ratio: "adaptive" }  // 智能选择
);
```

---

## 调试信息

代码会在控制台输出当前使用的服务：

```
🏠 [Development/Sandbox] 使用内置视频生成  # 沙箱环境
🚀 [Production] 使用 Google Veo API  # 生产环境
```

---

## 常见问题

### Q1: 沙箱环境能用Veo吗？
**A:** 不能。沙箱环境有网络限制，无法访问Google Cloud API。代码会自动降级到内置视频生成。

### Q2: 生产环境能用内置视频生成吗？
**A:** 可以。只要不设置 `GOOGLE_APPLICATION_CREDENTIALS`，代码就会使用内置视频生成。但生产环境建议使用Veo API。

### Q3: 生成的视频存储在哪里？
**A:** 
- **内置服务**：自动存储在对象存储中，返回的URL可直接使用，有有效期
- **Veo API**：存储在Google Cloud Storage中

### Q4: 如何确认当前使用的是哪个服务？
**A:** 查看控制台日志，会显示 `[Development/Sandbox]` 或 `[Production]` 标识。

### Q5: 内置服务支持音频吗？
**A:** 支持！默认开启音频生成，会自动生成对白、音效和背景音乐。

### Q6: 视频生成需要多长时间？
**A:** 
- 内置服务：通常30秒-2分钟
- Veo API：通常1-3分钟

---

## 技术实现

适配器位于 `src/lib/video.ts`，提供统一的接口：

```typescript
// 文本生成视频（推荐）
await generateVideo(prompt, options, customHeaders);

// 图片生成视频
await generateVideoFromImage(imageUrl, prompt, options, customHeaders);

// 批量生成（带并发控制）
await generateVideosBatch(prompts, options, customHeaders);

// 获取 HeaderUtils（用于提取请求头）
import { HeaderUtils } from "@/lib/video";
```

---

## 更新历史

- **2026-03-19**: 实现环境感知的视频生成适配器
- **2026-03-19**: 添加内置视频生成支持（沙箱环境）
- **2026-03-19**: 创建测试API验证功能
