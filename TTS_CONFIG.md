# TTS 配置说明（豆包语音合成模型2.0）

## 概述

本项目使用**火山引擎豆包语音合成模型2.0字符版**进行语音合成，采用 **V3 HTTP SSE 单向流式接口**。

## 环境变量配置

在项目根目录创建 `.env.local` 文件，添加以下内容：

```bash
# 火山引擎 TTS 配置（豆包语音合成模型2.0字符版）
VOLCENGINE_TTS_APP_ID=your_app_id
VOLCENGINE_TTS_TOKEN=your_access_token

# 火山引擎数字人视频生成（OmniHuman 1.5）
VOLCENGINE_ACCESS_KEY=your_access_key
VOLCENGINE_SECRET_KEY=your_secret_key
```

## 获取凭证

### 步骤1：创建火山引擎账号

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 注册并登录账号

### 步骤2：开通豆包语音合成模型2.0字符版

1. 进入「火山方舟」>「模型广场」
2. 找到「豆包语音合成模型2.0」
3. 点击「立即使用」> 选择「字符版」
4. 完成服务开通

### 步骤3：获取 APP ID 和 Access Token

1. 进入「火山方舟」>「模型广场」>「豆包语音合成模型2.0」
2. 点击「API接入」或「调用方式」
3. 复制以下信息：
   - **APP ID**：在控制台服务详情页获取
   - **Access Token**：在控制台服务详情页获取

### 步骤4：获取 Access Key 和 Secret Key（数字人生成用）

1. 进入「账号管理」>「访问密钥」
2. 点击「创建密钥」
3. 复制 **Access Key** 和 **Secret Key**

## API 接口信息

### TTS 接口

- **接口地址**：`https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse`
- **协议**：HTTP SSE（Server Sent Events）
- **鉴权方式**：Header-based
  - `X-Api-App-Key`: APP ID
  - `X-Api-Access-Key`: Access Token
  - `X-Api-Resource-Id`: `seed-tts-2.0`（豆包语音合成模型2.0字符版）
  - `X-Api-Connect-Id`: 连接追踪ID（UUID）

### 请求参数

```typescript
{
  "user": {
    "uid": "user_001"  // 用户ID
  },
  "req_params": {
    "text": "需要合成的文本",
    "speaker": "zh_female_vv_uranus_bigtts",  // 发音人ID
    "audio_params": {
      "format": "mp3",  // 音频格式：mp3/ogg_opus/pcm/wav
      "sample_rate": 24000  // 采样率：8000/16000/24000/48000
    }
  }
}
```

### 响应格式

SSE 流式响应，每次返回 JSON 数据：

```typescript
{
  "event": "TTSResponse",  // 事件类型
  "data": "base64编码的音频数据"  // 音频二进制数据
}
```

## 支持的发音人

### 通用场景音色（后缀 _uranus_bigtts）

| ID | 名称 | 描述 |
|----|------|------|
| zh_female_vv_uranus_bigtts | vivi 2.0 | 通用女声，适合多种场景 |
| zh_female_xiaohe_uranus_bigtts | 小何 | 通用女声，自然亲切 |
| zh_male_m191_uranus_bigtts | 云舟 | 成熟男声，适合品牌背书 |
| zh_male_taocheng_uranus_bigtts | 小天 | 阳光男声，适合知识博主 |
| en_male_tim_uranus_bigtts | Tim | 英文男声，适合英文内容 |

### 角色扮演音色（后缀 _tob）

| ID | 名称 | 描述 |
|----|------|------|
| saturn_zh_female_cancan_tob | 知性灿灿 | 角色扮演，知性优雅 |
| saturn_zh_female_keainvsheng_tob | 可爱女生 | 角色扮演，活泼可爱 |
| saturn_zh_female_tiaopigongzhu_tob | 调皮公主 | 角色扮演，俏皮灵动 |
| saturn_zh_male_shuanglangshaonian_tob | 爽朗少年 | 角色扮演，阳光帅气 |
| saturn_zh_male_tiancaitongzhuo_tob | 天才同桌 | 角色扮演，邻家少年 |

## 数字人视频生成 API

### 服务信息

- **服务名称**：OmniHuman 1.5
- **主机**：`visual.volcengineapi.com`
- **API 版本**：`2022-08-31`
- **服务名**：`cv`
- **区域**：`cn-north-1`

### API 端点

#### 数字人视频生成
```
POST /api/digital-human/generate
Body: {
  "portraitImage": "人像图片URL",
  "script": "口播文案",
  "voiceStyle": "声音风格",
  "motionStyle": "动作风格",
  "backgroundImage": "背景图片URL（可选）",
  "aspectRatio": "16:9 或 9:16"
}
```

#### 查询任务状态
```
GET /api/digital-human/status?task_id=xxx
```

## 常见问题

### Q1: TTS 返回 403 错误 "requested resource not granted"

**A:** 检查以下几点：
1. 确认已开通「豆包语音合成模型2.0字符版」服务
2. 确认 APP ID 和 Access Token 正确
3. 确认 X-Api-Resource-Id 为 `seed-tts-2.0`

### Q2: TTS 返回 500 错误 "mega model not found"

**A:** 检查 API 地址是否正确：
- ❌ 错误：`https://openspeech.bytedance.com/api/v1/tts`
- ✅ 正确：`https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse`

### Q3: 生成的音频在哪里？

**A:** 音频文件保存在 `/tmp/veo_audio/` 目录下，文件名格式为 `tts_时间戳.mp3`。

### Q4: 如何测试 TTS 是否正常工作？

**A:** 可以通过数字人视频生成接口测试，上传人像图片和文案，系统会自动调用 TTS 生成音频。

### Q5: 支持哪些音频格式？

**A:** 支持 `mp3`、`ogg_opus`、`pcm`、`wav` 格式。默认使用 `mp3`，采样率 `24000`。

### Q6: 数字人视频生成需要多长时间？

**A:** 通常需要 1-3 分钟，取决于：
- 文案长度（TTS 合成时间）
- 图片质量（主体识别时间）
- 视频时长（渲染时间）

## 技术实现

TTS 接口位于 `src/app/api/digital-human/generate/route.ts`，核心函数：

```typescript
async function generateTTS(
  script: string,
  voiceStyle: string
): Promise<{ audioUrl: string; duration: number }>
```

该函数会：
1. 发起 V3 HTTP SSE 请求
2. 流式接收音频数据
3. 合并所有音频块
4. 保存到本地 `/tmp/veo_audio/`
5. 返回音频文件路径和预估时长

## 官方文档

- [豆包语音合成模型2.0文档](https://www.volcengine.com/docs/6561/1329505)
- [大模型语音合成API列表](https://www.volcengine.com/docs/6561/1329505#2-1-requestrequest)
- [OmniHuman 1.5文档](https://www.volcengine.com/docs/6561/102448)

## 更新历史

- **2026-03-19**: 迁移到 V3 HTTP SSE 接口
- **2026-03-19**: 修复 API 地址和鉴权方式
- **2026-03-19**: 添加 SSE 流式响应处理
