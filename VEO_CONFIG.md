# Veo 视频生成配置说明

本项目使用 Google Veo 3.1 进行视频生成，需要配置以下环境变量：

## 必需配置

在项目根目录创建 `.env.local` 文件，添加以下内容：

```bash
# Google Cloud 项目配置
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account.json

# GCS 输出路径（视频存储位置）
GCS_OUTPUT_URI=gs://your-bucket/outputs/
```

## 获取服务账号凭证

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择项目 `red-atlas-490409-v1` 或创建新项目
3. 进入 **IAM & Admin > Service Accounts**
4. 创建服务账号或使用现有账号
5. 添加角色：`Vertex AI User` 和 `Storage Object Admin`
6. 创建 JSON 密钥并下载
7. 将文件路径设置到 `GOOGLE_APPLICATION_CREDENTIALS`

## 默认值（已内置）

- `GOOGLE_CLOUD_PROJECT`: `red-atlas-490409-v1`
- `GOOGLE_CLOUD_LOCATION`: `us-central1`
- `GCS_OUTPUT_URI`: `gs://red-atlas-video-assets/outputs/`

如果这些值与你的配置一致，只需设置 `GOOGLE_APPLICATION_CREDENTIALS` 即可。

## API 端点

### 提交视频生成任务
```
POST /api/veo/generate
Body: {
  "prompt": "视频描述",
  "duration": 8,        // 4, 6, 或 8 秒
  "aspectRatio": "16:9", // 16:9, 9:16, 或 1:1
  "projectId": "项目ID",
  "shotIndex": 0
}
```

### 查询任务状态
```
GET /api/veo/generate?operation_name=xxx
```

## 注意事项

1. 服务账号需要 Vertex AI API 访问权限
2. GCS bucket 需要允许服务账号写入
3. 视频生成通常需要 2-4 分钟
4. 免费额度：Google Cloud 提供 $300 免费额度
