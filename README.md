# AI 中文语音情绪分析系统

## 项目简介

本项目是一个基于 AI 的实时中文语音情绪分析系统，集成了语音识别（Vosk）、大语言模型（LLM，基于 LangChain 和 Ollama）情绪分析，以及 OSC 协议与多媒体软件（如 TouchDesigner）联动。系统可实时识别中文语音，分析文本情绪，并输出量化的情绪值。

## 功能特性

- **实时中文语音识别**（Vosk）
- **情绪分析**：基于大语言模型，结合自定义提示词模板，细致分析中文文本情绪
- **OSC 协议**：将情绪值通过 OSC 发送到外部应用（如 TouchDesigner）
- **模块化设计**：语音识别与情绪分析解耦，便于扩展
- **一键环境与模型自动配置**（setup.py）
- **Docker 支持**：提供 Dockerfile 实现容器化部署
- **环境变量配置**：通过环境变量控制各项参数，便于不同环境部署

## 目录结构

```
.
├── main.py                  # 程序入口，运行语音-情绪分析主流程
├── speech_recognizer.py     # 实时语音识别模块（Vosk）
├── voice_processor.py       # 情绪分析与OSC输出模块
├── prompt_template.txt      # LLM情绪分析提示词模板
├── requirements.txt         # 依赖库列表
├── setup.py                 # 一键环境与模型配置脚本
├── Dockerfile               # Docker镜像构建文件
├── .env.example             # 环境变量配置示例
├── vosk-model-small-cn/     # Vosk中文模型（自动下载）
└── ...
```

## 安装说明

### 方法一：本地安装

1. **克隆本仓库**，进入项目目录。
2. **运行一键配置脚本**（自动安装依赖并下载 Vosk 模型）：

   ```bash
   python setup.py
   ```

3. **（可选）手动安装依赖**：

   ```bash
   pip install -r requirements.txt
   ```

### 方法二：Docker 部署

1. **构建 Docker 镜像**：

   ```bash
   docker build -t ai-emotion .
   ```

2. **运行容器**：

   ```bash
   docker run -it --rm \
     --device /dev/snd \
     -e AI_EMOTION_OSC_IP=192.168.1.100 \
     -v /path/to/data:/data \
     ai-emotion
   ```

   > 注意：需要将 `--device /dev/snd` 添加以允许容器访问宿主机的音频设备。根据需要修改环境变量和挂载卷。

## 使用方法

1. **启动系统**：

   ```bash
   python main.py
   ```

2. **对着麦克风说话**，系统将：

   - 实时识别语音内容
   - 分析识别文本的情绪
   - 输出情绪值与简要解释
   - 通过 OSC 协议发送情绪值到配置的 IP/端口

3. **停止程序**：按 `Ctrl+C`

## 配置说明

### 环境变量配置

系统支持通过环境变量配置各项参数，可以复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
# 复制环境变量示例文件
cp .env.example .env

# 根据需要编辑配置
nano .env

# 启动时加载环境变量
source .env && python main.py
```

主要环境变量说明：

| 环境变量               | 说明             | 默认值                |
| ---------------------- | ---------------- | --------------------- |
| AI_EMOTION_INPUT_DIR   | 输入文件目录     | /opt/ai-emotion/input |
| AI_EMOTION_OSC_IP      | OSC 服务 IP 地址 | 127.0.0.1             |
| AI_EMOTION_OSC_PORT    | OSC 服务端口     | 7000                  |
| AI_EMOTION_LLM_MODEL   | LLM 模型名称     | deepseek-r1:1.5b      |
| AI_EMOTION_VOSK_MODEL  | 语音识别模型路径 | vosk-model-small-cn   |
| AI_EMOTION_SAMPLE_RATE | 音频采样率       | 16000                 |

完整环境变量列表请参考 `.env.example` 文件。

### 传统配置

- **Vosk 模型**：中文模型自动下载至`vosk-model-small-cn/`
- **OSC 输出**：默认 IP 为`127.0.0.1`，端口为`7000`
- **LLM 模型**：默认使用`deepseek-r1:1.5b`（Ollama）

## 情绪分析提示词模板

LLM 通过详细的提示词模板（`prompt_template.txt`）进行情绪分析，输出格式如下：

```json
{
    "emotion_value": <-1到1之间的浮点数>,
    "brief_explanation": "<一句话解释>"
}
```

示例：

```json
{
  "emotion_value": 0.85,
  "brief_explanation": "表达了强烈的喜悦和满足感"
}
```

## 依赖环境

主要依赖（详见`requirements.txt`）：

- `vosk`, `sounddevice`, `numpy`（语音识别）
- `langchain`, `langchain-ollama`, `langchain-community`（LLM 接口）
- `beautifulsoup4`（文本清洗）
- `python-osc`（OSC 协议）
- `tqdm`, `requests`（环境与模型下载）

## 注意事项

- 请确保麦克风可用且已连接
- 系统仅支持中文语音输入
- 建议本地部署 Ollama 并下载所需模型以获得最佳效果

## 许可证

[请在此处补充您的许可证信息]
