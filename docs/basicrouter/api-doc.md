# 对外 API 接入文档

BasicRouter AI 开放平台接口文档，供第三方开发者接入使用

## 1. 概述

BasicRouter AI 开放平台提供统一的 RESTful API，支持文本对话、图像生成、视频生成三类能力。所有接口均需通过 API Key 认证，计费基于账户积分（Credits）体系。

| 属性     | 值                                                           |
| -------- | ------------------------------------------------------------ |
| Base URL | https://api.basicrouter.ai/api                               |
| 协议     | HTTPS                                                        |
| 数据格式 | JSON                                                         |
| 字符编码 | UTF-8                                                        |
| 超时建议 | 普通接口 30s，图片接口 120s，流式接口 300s，视频任务异步轮询 |

## 2. 认证方式

所有 API 请求必须在 HTTP Header 中携带 Authorization 字段，格式如下：

代码块
HTTP

```
Authorization: Bearer YOUR_API_KEY
```

API Key 可在控制台的「API Key 管理」页面创建和管理，请妥善保管，不要在公开代码中泄露。

## 3. 通用响应格式

所有接口（除流式 SSE 外）均返回统一的 JSON 结构：

代码块
JSON

```
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

| 字段    | 类型           | 说明                             |
| ------- | -------------- | -------------------------------- |
| code    | integer        | 200 表示成功，其他为错误码       |
| message | string         | 操作描述，成功时通常为 "success" |
| data    | object / array | 具体业务数据，失败时可能为 null  |

## 4. 错误码说明

| 错误码 | 说明                          |
| ------ | ----------------------------- |
| 200    | 成功                          |
| 400    | 请求参数错误                  |
| 401    | 未授权，Token 无效或已过期    |
| 403    | 无权限访问                    |
| 404    | 资源不存在                    |
| 429    | 请求频率超限                  |
| 500    | 服务器内部错误                |
| -1     | Insufficient credit，余额不足 |

## 5. 接口详情

### 5.1 文本对话（非流式）

#### 5.1.1 OpenAI兼容

| 属性         | 值                   |
| ------------ | -------------------- |
| 方法         | POST                 |
| 路径         | /v1/chat/completions |
| Content-Type | application/json     |
| 认证         | Bearer Token（必须） |

#### 文本对话

请求示例：
文本对话
Curl
Python
Java
展开
收起
代码块
BASH

```
curl -X POST 'https://api.basicrouter.ai/api/v1/chat/completions' \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.6-plus",
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": "你是谁？"
        }
    ]
  }'
```

响应参数：

200
成功
JSON
展开
收起
代码块
JSON

```
{
  "choices": [
      {
          "message": {
              "role": "assistant",
              "content": "我是千问，阿里巴巴集团旗下的通义实验室自主研发的超大规模语言模型。我可以帮助你回答问题、创作文字，比如写故事、写公文、写邮件、写剧本、逻辑推理、编程等等，还能表达观点，玩游戏等。如果你有任何问题或需要帮助，欢迎随时告诉我！"
          },
          "finish_reason": "stop",
          "index": 0,
          "logprobs": null
      }
  ],
  "object": "chat.completion",
  "usage": {
      "prompt_tokens": 26,
      "completion_tokens": 66,
      "total_tokens": 92
  },
  "created": 1726127645,
  "system_fingerprint": null,
  "model": "qwen3.6-plus",
  "id": "chatcmpl-81951b98-28b8-9659-ab07-xxxxxx"
}
```

#### 图片理解

请求示例：
图片理解
Curl
Python
展开
收起
代码块
BASH

```
curl --location 'https://api.basicrouter.ai/api/v1/chat/completions' \
  --header "Authorization: Bearer $API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "qwen3.6-plus",
    "messages": [
        {"role": "user",
         "content": [
              {"type": "image_url", "image_url": {"url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"}},
              {"type": "text", "text": "图中描绘的是什么景象?"}
          ]
        }]
  }'
```

响应参数：

200
成功
JSON
展开
收起
代码块
JSON

```
{
  "choices": [
      {
          "message": {
              "content": "这是一张在海滩上拍摄的照片。照片中，一个人和一只狗坐在沙滩上，背景是大海和天空。人和狗似乎在互动，狗的前爪搭在人的手上。阳光从画面的右侧照射过来，给整个场景增添了一种温暖的氛围。",
              "role": "assistant"
          },
          "finish_reason": "stop",
          "index": 0,
          "logprobs": null
      }
  ],
  "object": "chat.completion",
  "usage": {
      "prompt_tokens": 1270,
      "completion_tokens": 54,
      "total_tokens": 1324
  },
  "created": 1725948561,
  "system_fingerprint": null,
  "model": "qwen3.6-plus",
  "id": "chatcmpl-0fd66f46-b09e-9164-a84f-3ebbbedbac15"
}
```

#### 视频理解

请求示例：
视频理解
Curl
Python
展开
收起
代码块
BASH

```
curl --location 'https://api.basicrouter.ai/api/v1/chat/completions' \
  --header "Authorization: Bearer $API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "qwen3.6-plus",
    "messages": [
        {"role": "user",
         "content": [
              {
                  "type": "video_url",
                  "video_url": {
                      "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241115/cqqkru/1.mp4"
                  },
                  "fps": 2
              },
              {
                  "type": "text",
                  "text": "这段视频的内容是什么?"
              }
          ]
        }]
  }'
```

#### 流式输出

请求示例：
流式输出
Curl
Python
展开
收起
代码块
BASH

```
curl -X POST https://api.basicrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  --no-buffer \
  -d '{
    "model": "qwen-plus",
    "messages": [
        {"role": "user", "content": "你是谁？"}
    ],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'
```

响应参数：

200
成功
SSE
展开
收起
代码块
JSON

```
data: {"choices":[{"delta":{"content":"","role":"assistant"},"index": 0,"logprobs": null,"finish_reason": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"finish_reason": null,"delta":{"content":"我是"},"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"delta":{"content":"来自"},"finish_reason": null,"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"delta":{"content":"阿里"},"finish_reason": null,"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"delta":{"content":"云的超大规模语言"},"finish_reason": null,"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"delta":{"content":"模型，我叫通义千问"},"finish_reason": null,"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"delta":{"content":"。"},"finish_reason": null,"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[{"finish_reason":"stop","delta":{"content":""},"index": 0,"logprobs": null}],"object":"chat.completion.chunk","usage": null,"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: {"choices":[],"object":"chat.completion.chunk","usage":{"prompt_tokens": 22,"completion_tokens": 17,"total_tokens": 39},"created": 1726132850,"system_fingerprint": null,"model":"qwen-plus","id": "chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}

data: [DONE]
```

流式响应说明：

- data：消息的数据负载，通常是一个JSON字符串。
- [DONE]：表示整个流式响应已结束。

#### 5.1.2 官方接口

| 属性         | 值                   |
| ------------ | -------------------- |
| 方法         | POST                 |
| 路径         | /ai/createText       |
| Content-Type | application/json     |
| 响应类型     | application/json     |
| 超时         | 300 秒               |
| 认证         | Bearer Token（必须） |

#### 请求体（Request Body）：

| 字段          | 类型    | 必填 | 说明                                                               |
| ------------- | ------- | ---- | ------------------------------------------------------------------ |
| model         | string  | 是   | 模型名称，如 "gpt-4o"                                              |
| messages      | array   | 是   | 对话消息列表，每条消息包含 role（user/assistant/system）和 content |
| temperature   | float   | 否   | 采样温度，范围 0~2，默认 0.7                                       |
| topP          | float   | 否   | 核采样参数，默认 0.9                                               |
| maxTokens     | integer | 否   | 最大生成 token 数量                                                |
| openWebSearch | boolean | 否   | 是否开启联网搜索                                                   |
| needCache     | boolean | 否   | 是否启用缓存                                                       |
| chatId        | string  | 否   | 对话 ID，用于关联上下文                                            |

#### content 字段支持多模态（文本 + 图片）：

| 类型        | 字段      | 说明                   |
| ----------- | --------- | ---------------------- |
| input_text  | text      | 纯文本内容             |
| input_image | image_url | 图片 URL（多模态场景） |

#### 多模态调用请求示例：

请求示例：
多模态调用请求示例：
JSON
展开
收起
代码块
JSON

```
{
  "model": "doubao-seed-2-0-pro",
  "openWebSearch": false,
  "temperature": 0.7,
  "topP": 0.9,
  "maxTokens": 2048,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_image",
          "image_url": "https://basicrouter-flie.oss-cn-hongkong.aliyuncs.com/prod/all_backend/lyy/20260420143050859.png"
        },
        {
          "type": "input_text",
          "text": "分析下这个图片"
        }
      ]
    }
  ],
  "needCache": true,
  "chatId": "49688B04-485C-4C20-9EE9-46619EA7A113"
}
```

#### 响应示例：

200
成功
JSON
展开
收起
代码块
JSON

```
{
  "code": 200,
  "data": {
    "chatId": "49688B04-485C-4C20-9EE9-46619EA7A113",
    "inputToken": 5251,
    "cacheToken": 0,
    "outputToken": 581,
    "totalToken": 0,
    "message": {
      "role": "assistant",
      "content": [{ "text": "太棒了！...", "type": "output_text" }],
      "toolCalls": null,
      "toolCallId": null
    },
    "status": null,
    "toolCalls": null,
    "finishReason": null
  },
  "message": "success"
}
```

#### 响应 data 字段说明：

| 字段         | 类型    | 说明                                          |
| ------------ | ------- | --------------------------------------------- |
| chatId       | string  | 对话 ID                                       |
| inputToken   | integer | 输入 token 数                                 |
| cacheToken   | integer | 命中缓存的 token 数                           |
| outputToken  | integer | 输出 token 数                                 |
| totalToken   | integer | 总消耗 token                                  |
| message      | object  | AI 回复消息，包含 role、content、toolCalls 等 |
| finishReason | string  | 结束原因：stop / length / tool_calls 等       |

### 5.2 文本对话（流式 SSE）

| 属性         | 值                       |
| ------------ | ------------------------ |
| 方法         | POST                     |
| 路径         | /ai/createText/stream    |
| Content-Type | application/json         |
| 响应类型     | text/event-stream（SSE） |
| 超时         | 300 秒                   |
| 认证         | Bearer Token（必须）     |

请求体字段与 5.1 完全相同，此处不再重复。

#### SSE 事件格式说明：

| event   | 说明                                              |
| ------- | ------------------------------------------------- |
| message | 正常增量文本片段，data 字段为 JSON 字符串         |
| error   | 发生错误，data 字段为错误描述字符串，连接随后关闭 |
| [DONE]  | 流结束标志（部分底层可能使用）                    |

#### 客户端接收示例（JavaScript）：

请求示例：
客户端接收示例（JavaScript）：
JavaScript
展开
收起
代码块
JAVASCRIPT

```
"hl-keyword">const evtSource = "hl-keyword">new EventSource('/ai/createText/stream', {
  "hl-comment">// 需使用支持 POST + SSE 的库，如 @microsoft/fetch-event-source
});
evtSource.addEventListener('message', (e) => {
  "hl-keyword">const chunk = JSON.parse(e.data);
  console.log(chunk);
});
evtSource.addEventListener('error', (e) => {
  console.error('SSE error:', e.data);
  evtSource.close();
});
```

### 5.3 图像生成

| 属性         | 值                   |
| ------------ | -------------------- |
| 方法         | POST                 |
| 路径         | /ai/createImage      |
| Content-Type | application/json     |
| 认证         | Bearer Token（必须） |

#### 请求体（Request Body）：

| 字段       | 类型                   | 必填 | 说明                                   |
| ---------- | ---------------------- | ---- | -------------------------------------- |
| model      | string                 | 是   | 图像模型名称（如 dall-e-3、flux-1 等） |
| text       | string                 | 是   | 图像生成提示词，不能为空               |
| count      | integer                | 是   | 生成图片数量，默认 1，需 ≥ 0          |
| resolution | string                 | 否   | 分辨率，如 "720p"                      |
| ratio      | string                 | 否   | 宽高比，如 "16:9"                      |
| imageUrls  | array<string></string> | 否   | 参考图 URL 列表（图生图场景）          |

#### 成功响应 data 字段：

| 字段      | 类型                   | 说明                |
| --------- | ---------------------- | ------------------- |
| imageUrls | array<string></string> | 生成图片的 URL 列表 |

#### 请求示例：

请求示例：
5.3 图像生成
JSON
展开
收起
代码块
JSON

```
{
  "model": "seedream-5-0",
  "text": "一只狗在奔跑",
  "count": 1,
  "resolution": "2k",
  "ratio": "1: 1",
  "imageUrls": []
}
```

#### 响应示例：

200
成功
JSON
展开
收起
代码块
JSON

```
{
  "code": 200,
  "message": "success",
  "data": {
    "imageUrls": [
      "https://cdn.example.com/images/generated-abc123.png"
    ]
  }
}
```

### 5.4 视频生成（异步）

| 属性         | 值                                                       |
| ------------ | -------------------------------------------------------- |
| 方法         | POST                                                     |
| 路径         | /ai/createVideo                                          |
| Content-Type | application/json                                         |
| 认证         | Bearer Token（必须）                                     |
| 注意         | 视频生成为异步任务，接口返回 taskId，需调用 5.5 轮询结果 |

#### 请求体（Request Body）：

| 字段       | 类型                   | 必填     | 说明                                                                                 |
| ---------- | ---------------------- | -------- | ------------------------------------------------------------------------------------ |
| model      | string                 | 是       | 视频模型名称                                                                         |
| text       | string                 | 是       | 视频生成提示词，不能为空                                                             |
| videoType  | integer                | 是       | 生成类型：1=文生视频，2=图生视频（首帧），3=图生视频（首尾帧），4=图生视频（参考图） |
| urls       | array<string></string> | 条件必填 | 图片 URL 列表，videoType≠1 时必填                                                   |
| resolution | string                 | 否       | 分辨率，如 "720p"                                                                    |
| ratio      | string                 | 否       | 宽高比，如 "16:9"                                                                    |
| duration   | long                   | 否       | 时长（秒），需为正整数                                                               |

#### 成功响应 data 字段：

| 字段   | 类型   | 说明                                                        |
| ------ | ------ | ----------------------------------------------------------- |
| taskId | string | 任务 ID，用于查询进度（调用 5.5 接口）                      |
| status | string | 任务当前状态（submitted / processing / succeeded / failed） |

#### 请求示例：

请求示例：
5.4 视频生成（异步）
JSON
展开
收起
代码块
JSON

```
{
  "videoType": 1,
  "urls": [],
  "text": "一只狗在奔跑",
  "resolution": "720p",
  "ratio": "16: 9",
  "duration": 4,
  "model": "wan2.6-t2v"
}
```

### 5.5 查询视频任务状态

| 属性 | 值                   |
| ---- | -------------------- |
| 方法 | GET                  |
| 路径 | /ai/getVideoByTaskId |
| 认证 | Bearer Token（必须） |

#### 请求参数（Query String）：

| 参数名 | 类型   | 必填 | 说明                        |
| ------ | ------ | ---- | --------------------------- |
| taskId | string | 是   | 由创建视频接口返回的 taskId |

#### 成功响应 data 字段：

| 字段         | 类型   | 说明                                                  |
| ------------ | ------ | ----------------------------------------------------- |
| status       | string | 任务状态：submitted / processing / succeeded / failed |
| videoUrl     | string | 视频下载/播放地址（status=succeeded 时有效）          |
| lastFrameUrl | string | 视频最后一帧图片 URL（可选）                          |
| message      | string | 状态描述或错误信息                                    |

#### 请求示例：

请求示例：
5.5 查询视频任务状态
GET
展开
收起
GET /ai/getVideoByTaskId?taskId=task_abc123456

#### 响应示例：

200
成功
JSON
展开
收起
代码块
JSON

```
{
  "code": 200,
  "message": "success",
  "data": {
    "status": "succeeded",
    "videoUrl": "https://cdn.example.com/videos/result-abc123.mp4",
    "lastFrameUrl": "https://cdn.example.com/frames/last-abc123.jpg",
    "message": "Video generated successfully"
  }
}
```

### 5.6 获取模型列表

| 属性 | 值               |
| ---- | ---------------- |
| 方法 | GET              |
| 路径 | /employee/models |
| 认证 | 无需             |

#### 请求参数（Query String）：

| 参数名   | 类型   | 必填 | 说明                                                          |
| -------- | ------ | ---- | ------------------------------------------------------------- |
| category | string | 否   | 模型类别过滤，如 text / image / video，不传则返回所有可见模型 |

#### 成功响应 data 字段：

| 字段             | 类型    | 说明                                                                                           |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------- |
| id               | string  | 模型 ID（UUID）                                                                                |
| modelName        | string  | 模型展示名称                                                                                   |
| provider         | string  | 模型提供商，如 OpenAI、Anthropic                                                               |
| description      | string  | 模型描述                                                                                       |
| category         | string  | 模型类别：text / image / video 等                                                              |
| status           | boolean | 是否启用                                                                                       |
| whitelistFlag    | boolean | 是否已启用开白                                                                                 |
| online           | boolean | 是否上线                                                                                       |
| isDefault        | boolean | 是否为默认模型                                                                                 |
| sortOrder        | integer | 排序值，数值越小越靠前                                                                         |
| multiText        | boolean | 是否支持多模态                                                                                 |
| imageCount       | integer | 单次最多生成图片数量                                                                           |
| videoDurationMin | integer | 视频最短时长（秒）                                                                             |
| allowVideoType   | String  | 允许的视频生成类型：1=文生视频，2=图生视频（首帧），3=图生视频（首尾帧），4=图生视频（参考图） |

#### 请求示例：

请求示例：
5.6 获取模型列表
GET
展开
收起
GET /employee/models?category=text

#### 响应示例：

200
成功
JSON
展开
收起
代码块
JSON

```
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "uuid-abc123",
      "modelName": "gpt-4o",
      "provider": "OpenAI",
      "description": "最强通用大模型",
      "category": "text",
      "status": true,
      "online": true,
      "isDefault": false,
      "sortOrder": 1,
      "multiText": true,
      "modelPrices": [
        {"modelId": "uuid-abc123", "inputPrice": 0.005, "outputPrice": 0.015, "unit": "1K tokens"}
      ]
    }
  ]
}
```

## 6. 注意事项

- 积分余额：所有接口在处理前均会校验账户积分，余额 ≤ 0 时返回 "Insufficient credit" 错误，请及时充值。
- 模型名称：请求中的 model 字段填写平台 modelName（即展示名称），系统内部会自动映射到底层模型 ID。
- 视频任务轮询：视频生成为异步任务，建议每 5~10 秒轮询一次任务状态，最长等待时间视模型而定（通常 60~300 秒）。
- 流式连接：流式接口（SSE）默认超时 300 秒，客户端需保持长连接。若服务器发送 error 事件，应及时关闭连接。
- 并发限制：单 API Key 默认并发请求数受平台限制，超出后请求将被排队或拒绝，具体限额请咨询平台。
- HTTPS 强制：生产环境请务必使用 HTTPS，避免 API Key 在传输中泄露。
- 模型开白：如需使用模型开白，请联系客服。
  如有问题请联系 BasicRouter 官方支持：
  basicroutersupport@basic-ware.ai
