# 智能食物热量识别 App - 技术规划方案（已确认）

> 最后更新：基于用户讨论确认

---

## 一、技术栈

| 层面 | 技术选型 | 说明 |
|------|---------|------|
| 前端框架 | React Native (Expo) | 跨平台，最终形态为手机App |
| 语言 | TypeScript | 类型安全 |
| 摄像头 | expo-camera | Expo 官方相机模块 |
| 后端 | Python FastAPI | 本地运行，模块化设计 |
| AI 接口 | Google Gemini 2.0 Flash (可切换架构) | 视觉分析，第一阶段主力 |
| 隧道穿透 | ngrok | 将本地服务暴露为公网HTTPS地址 |
| 数据存储 | SQLite (本地) | 存储识别历史记录 |
| 双语方案 | i18next / react-i18next | 中英文切换 |
| 后续扩展 | 可插拔 AnalysisEngine | 后续可接入 OpenAI / 本地ML |

---

## 二、网络架构（核心设计）

```
                        ┌──────────────────┐
                        │   Google Gemini   │
                        │      API          │
                        └────────┬─────────┘
                                 │ HTTPS
                                 │
                    ┌────────────▼────────────┐
                    │   本地 PC (你的电脑)       │
                    │   Python FastAPI 服务     │
                    │   localhost:8000          │
                    │                          │
                    │   ┌──────────────────┐   │
                    │   │  AnalysisEngine   │   │
                    │   │  (可插拔设计)      │   │
                    │   ├──────────────────┤   │
                    │   │  GeminiEngine    │   │ ← 当前在用
                    │   │  OpenAIEngine    │   │ ← 后续扩展
                    │   │  LocalMLEngine   │   │ ← 后续扩展
                    │   └──────────────────┘   │
                    │          │                │
                    │   ┌──────▼───────┐       │
                    │   │  SQLite 数据库│       │
                    │   │ (识别历史记录) │       │
                    │   └──────────────┘       │
                    └────────┬─────────────────┘
                             │ ngrok 隧道
                    ┌────────▼─────────┐
                    │  ngrok 公网地址    │
                    │ https://xxx.ngrok │
                    │   .io             │
                    └────────┬─────────┘
                             │ HTTPS (4G/5G/WiFi)
                    ┌────────▼─────────┐
                    │  手机 React Native │
                    │   App (Expo)      │
                    │                   │
                    │  ● 拍照 → 上传    │
                    │  ● 接收结果展示    │
                    │  ● 查看历史记录    │
                    └──────────────────┘
```

### 通信流程
1. 手机（无论4G/5G/WiFi）→ 通过 ngrok 公网地址 → 发送图片到你的本地 PC
2. PC 端 FastAPI 接收图片 → 调用 Gemini API → 获取分析结果
3. 结果存入 SQLite 数据库 → 返回结构化 JSON 给手机
4. 手机展示：食物名(kcal/kg)、估重、总热量

### 迁移到云端
整个后端是模块化的，迁移时只需要：
- 将 FastAPI 服务部署到云服务器（阿里云/AWS/Railway）
- 把数据库从 SQLite 切换到 PostgreSQL（代码改动极小）
- 前端只需修改 API_BASE_URL 这一个配置项

---

## 三、后端模块化设计（核心）

```
backend/
├── main.py                 # FastAPI 入口，路由注册
├── config.py               # 配置管理（API Key、数据库等）
├── engines/                # 分析引擎（可插拔）
│   ├── __init__.py
│   ├── base.py             # AbstractEngine 抽象基类
│   ├── gemini_engine.py    # Gemini 实现
│   ├── openai_engine.py    # OpenAI 实现（预留）
│   └── ml_engine.py        # 本地 ML 实现（预留）
├── models/                 # 数据模型
│   ├── __init__.py
│   ├── analysis.py         # FoodItem, AnalysisResult
│   └── history.py          # HistoryRecord
├── database/               # 数据库层
│   ├── __init__.py
│   ├── connection.py       # 数据库连接
│   └── crud.py             # 增删改查
├── services/               # 业务逻辑
│   ├── __init__.py
│   ├── analyzer.py         # 分析编排（选引擎→调用→融合）
│   └── history_service.py  # 历史记录服务
├── routers/                # API 路由
│   ├── __init__.py
│   ├── analyze.py          # POST /analyze - 拍照分析
│   └── history.py          # GET /history - 历史记录
├── utils/                  # 工具
│   ├── __init__.py
│   └── image.py            # 图片压缩/Base64/预处理
└── requirements.txt
```

---

## 四、API 接口设计

### POST /analyze - 核心接口

**请求：**
```json
{
  "image": "(Base64 encoded image data)",
  "language": "zh"  // 或 "en"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "foods": [
      {
        "name": "清炒西兰花",
        "nameEn": "Stir-fried Broccoli",
        "category": "蔬菜",
        "categoryEn": "vegetable",
        "caloriesPerKg": 350,
        "estimatedWeightG": 250,
        "estimatedCalories": 87.5,
        "confidence": 0.92
      }
    ],
    "totalEstimatedCalories": 87.5
  },
  "note": "估算仅供参考，实际热量可能因烹饪方式而异"
}
```

### GET /history - 历史记录

**响应：**
```json
{
  "records": [
    {
      "id": 1,
      "image_thumbnail": "(Base64小图)",
      "foods": [...],
      "totalCalories": 87.5,
      "createdAt": "2026-05-08T12:30:00Z"
    }
  ]
}
```

---

## 五、AI Prompt 结构化设计

向 Gemini 发送的指令使用**结构化 Prompt**，确保返回格式稳定可解析：

```
你是一个专业的食物营养分析助手。你需要：
1. 识别图片中的所有食物
2. 判断食物种类和中英文名称
3. 给出每种食物每1千克的热量值（kcal/kg）
4. 仅根据图片视觉信息，估计当前盘中每种食物的重量（克）
5. 计算每种食物的估算总热量

必须严格按照以下 JSON 格式返回，不要包含额外文字：
{
  "foods": [
    {
      "name": "清炒西兰花",
      "nameEn": "Stir-fried Broccoli",
      "category": "蔬菜",
      "categoryEn": "vegetable",
      "caloriesPerKg": 350,
      "estimatedWeightG": 200,
      "estimatedCalories": 70,
      "confidence": 0.95,
      "reasoning": "从颜色和质地判断为清炒西兰花"
    }
  ],
  "totalEstimatedCalories": 70
}
```

---

## 六、分阶段实施计划

### 第一阶段：MVP（✅ 确认实施）
- [ ] **1.1** 初始化 React Native (Expo) 项目
- [ ] **1.2** 搭建 Python FastAPI 后端（模块化结构）
- [ ] **1.3** 实现拍照功能（expo-camera）
- [ ] **1.4** 实现 Gemini Engine（结构化Prompt）
- [ ] **1.5** 实现分析结果展示页面（中英文双语）
- [ ] **1.6** 配置 ngrok 隧道 + 手机端网络连接
- [ ] **1.7** 实现历史记录存储与查看

### 第二阶段：完善（后续）
- [ ] 引入本地 ML 模型
- [ ] 饮食日记/统计图表
- [ ] 拍照指南优化
- [ ] 用户反馈闭环

### 第三阶段：上线（后续）
- [ ] 迁移到云服务器
- [ ] 性能优化
- [ ] 应用商店发布

---

## 七、关键技术挑战

| 挑战 | 应对方案 |
|------|---------|
| 单张照片估重不准确 | 接受"合理估算"，UI上展示置信度和误差范围 |
| Gemini API 延迟 | 后端异步处理 |
| 手机访问本地服务器 | ngrok 隧道穿透，支持4G/5G/WiFi |
| 中英文食物名 | Gemini 直接同时返回中英文名 |
| API费用 | Gemini 免费额度充足 |
| 模块化迁移 | 统一接口 + 配置化管理 |

---

## 八、所需环境准备

1. **Node.js** (>= 18) - Expo 开发环境
2. **Python** (>= 3.10) - FastAPI 后端
3. **Google Gemini API Key** - 注册 Google AI Studio 获取
4. **ngrok** - 隧道穿透工具
5. **Expo Go** - 手机端测试 App

如果以上方案你觉得没问题，我就开始逐步实现了。先从后端（FastAPI 模块化框架 + Gemini 集成）开始，再做前端（拍照 + 展示）。
