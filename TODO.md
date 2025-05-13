# 项目待办事项

## 1. Plutchik 情感轮结构化输出测试

- 测试 EmotionAnalysis 模型的结构化输出
- 验证 XML 解析和 EmotionDimensions 各情感维度数据的准确性
- 确保 dominant_emotion 正确反映最强烈的情感
- 测试极端情况和边界值处理

## 2. 重新划分目录结构，分为 server（FastAPI）和 client 端(Next.js)

### 目录结构设计

```
ai-emotion/
├── server/              # FastAPI后端服务
│   ├── app/
│   │   ├── api/         # API路由
│   │   ├── core/        # 核心功能
│   │   ├── models/      # 数据模型
│   │   └── services/    # 业务服务
│   ├── Dockerfile       # 后端Docker配置
│   └── requirements.txt # 后端依赖
├── client/              # Next.js前端应用
│   ├── app/             # Next.js页面和路由
│   ├── components/      # React组件
│   ├── public/          # 静态资源
│   ├── styles/          # 样式文件
│   ├── Dockerfile       # 前端Docker配置
│   └── package.json     # 前端依赖
└── docker-compose.yml   # 容器编排配置
```

### 客户端交互设计

#### 主要功能

1. 实时情感分析可视化

   - 显示 Plutchik 情感轮的交互式图表
   - 实时更新八种基本情感维度的强度
   - 直观展示 dominant_emotion

2. 语音输入和文本分析界面

   - 录音功能，将语音转为文本
   - 显示语音识别结果与情感分析结果

3. 设置界面
   - 配置 OSC 输出参数
   - 选择语言模型和参数设置
   - 调整情感分析阈值

#### 用户界面设计

- 现代简约的 UI 设计，暗色主题为主
- 响应式布局，适配桌面和移动设备
- 情感轮中心为主要情感展示区
- 侧边栏包含历史记录和设置
- 顶部导航栏提供功能切换

#### API 交互

- WebSocket 连接实现实时情感分析结果展示
- RESTful API 用于历史数据查询和系统配置
- 支持批量文本分析的异步处理

## 3. 打包前后端镜像, 通过 docker-compose 编排

- 为前端和后端分别创建优化的 Docker 镜像
- 配置 docker-compose.yml 实现容器间通信
- 设置环境变量便于配置
- 实现数据卷挂载保存历史数据
- 配置网络设置确保安全性
- 优化构建流程，减小镜像体积
