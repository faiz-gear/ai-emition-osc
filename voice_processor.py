# voice_processor.py
import os
import time
import asyncio
from typing import Optional, List, Dict, Any
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from pythonosc import udp_client
import xml.etree.ElementTree as ET

# ============== 配置区 ==============
# 从环境变量读取配置，如果不存在则使用默认值
INPUT_DIR = Path(
    os.environ.get("AI_EMOTION_INPUT_DIR", "/opt/ai-emotion/input")
)  # 语音文件存放目录
OSC_IP = os.environ.get("AI_EMOTION_OSC_IP", "127.0.0.1")
OSC_PORT = int(os.environ.get("AI_EMOTION_OSC_PORT", "7000"))
POLL_INTERVAL = float(os.environ.get("AI_EMOTION_POLL_INTERVAL", "1"))  # 轮询间隔（秒）
LLM_MODEL = os.environ.get("AI_EMOTION_LLM_MODEL", "deepseek-r1:1.5b")
LLM_TEMPERATURE = float(os.environ.get("AI_EMOTION_LLM_TEMPERATURE", "0.6"))
# ===================================

# 读取提示词模板
PROMPT_TEMPLATE_PATH = os.environ.get(
    "AI_EMOTION_PROMPT_TEMPLATE", "prompt_template.txt"
)
with open(PROMPT_TEMPLATE_PATH, "r", encoding="utf-8") as f:
    EMOTION_PROMPT_TEMPLATE = f.read()


class EmotionDimensions(BaseModel):
    """Plutchik情感轮的八种基本情感维度"""

    joy: float = Field(ge=0.0, le=1.0, description="喜悦情绪强度，范围0-1")
    trust: float = Field(ge=0.0, le=1.0, description="信任情绪强度，范围0-1")
    fear: float = Field(ge=0.0, le=1.0, description="恐惧情绪强度，范围0-1")
    surprise: float = Field(ge=0.0, le=1.0, description="惊讶情绪强度，范围0-1")
    sadness: float = Field(ge=0.0, le=1.0, description="悲伤情绪强度，范围0-1")
    disgust: float = Field(ge=0.0, le=1.0, description="厌恶情绪强度，范围0-1")
    anger: float = Field(ge=0.0, le=1.0, description="愤怒情绪强度，范围0-1")
    anticipation: float = Field(ge=0.0, le=1.0, description="期待情绪强度，范围0-1")


class EmotionAnalysis(BaseModel):
    """多维度情感分析结果的结构化输出模型"""

    dimensions: EmotionDimensions = Field(description="Plutchik情感轮的八种情感维度")
    dominant_emotion: str = Field(
        description="最主要的情感，如果所有情感都低于阈值则为neutral"
    )
    brief_explanation: str = Field(description="对情感分析的简短解释，不超过100字")


class XMLOutputParser:
    """解析XML格式的情感分析输出"""

    def __init__(self):
        self.emotion_dimensions = [
            "joy",
            "trust",
            "fear",
            "surprise",
            "sadness",
            "disgust",
            "anger",
            "anticipation",
        ]

    def parse(self, text: str) -> EmotionAnalysis:
        """解析XML格式的输出并转换为EmotionAnalysis对象"""
        try:
            # 提取<emotion_analysis>标签内的内容
            start_tag = "<emotion_analysis>"
            end_tag = "</emotion_analysis>"

            start_index = text.find(start_tag)
            end_index = text.find(end_tag) + len(end_tag)

            if start_index == -1 or end_index == -1:
                raise ValueError("未找到有效的emotion_analysis XML标签")

            xml_content = text[start_index:end_index]

            # 解析XML
            root = ET.fromstring(xml_content)

            # 解析情感维度
            dimensions_data = {}
            dimensions_elem = root.find("dimensions")
            if dimensions_elem is not None:
                for dim in self.emotion_dimensions:
                    dim_elem = dimensions_elem.find(dim)
                    dimensions_data[dim] = (
                        float(dim_elem.text) if dim_elem is not None else 0.0
                    )

            # 获取主要情感和解释
            dominant_emotion = root.find("dominant_emotion")
            brief_explanation = root.find("brief_explanation")

            # 构建EmotionAnalysis对象
            return EmotionAnalysis(
                dimensions=EmotionDimensions(**dimensions_data),
                dominant_emotion=(
                    dominant_emotion.text if dominant_emotion is not None else "neutral"
                ),
                brief_explanation=(
                    brief_explanation.text if brief_explanation is not None else ""
                ),
            )

        except Exception as e:
            print(f"XML解析错误: {str(e)}")
            print(f"原始文本: {text}")
            # 返回一个默认的中性情感分析结果
            return EmotionAnalysis(
                dimensions=EmotionDimensions(
                    joy=0.0,
                    trust=0.0,
                    fear=0.0,
                    surprise=0.0,
                    sadness=0.0,
                    disgust=0.0,
                    anger=0.0,
                    anticipation=0.0,
                ),
                dominant_emotion="neutral",
                brief_explanation="解析错误，返回默认中性结果",
            )


class VoiceProcessor:
    def __init__(self):
        self.osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)
        self.processed_files = set()

        # 初始化LangChain组件
        self.parser = XMLOutputParser()

        # 构建提示模板
        self.prompt = ChatPromptTemplate.from_template(EMOTION_PROMPT_TEMPLATE)

        # 初始化LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]),
        )

    async def process_text(self, text: str) -> None:
        """直接处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 使用LLM进行情感分析
            llm_response = await self.llm.agenerate(
                [self.prompt.format(用户输入文本=text)]
            )
            result = self.parser.parse(llm_response.generations[0][0].text)

            # 发送数据到TouchDesigner - 所有情感维度一起发送
            dimensions = result.dimensions.model_dump()
            self.osc_client.send_message("/emotion", [dimensions])

            # 额外发送主要情感
            # self.osc_client.send_message("/emotion/dominant", [result.dominant_emotion])

            # 打印分析结果
            print(f"\n[情感分析结果]")
            print(f"主要情感: {result.dominant_emotion}")
            for emotion, value in dimensions.items():
                print(f"{emotion}: {value:.2f}")
            print(f"解释: {result.brief_explanation}")

        except Exception as e:
            print(f"[错误] 处理文本时发生错误: {str(e)}")

    async def process_file(self, file_path: Path) -> None:
        """处理文件中的文本"""
        try:
            text = file_path.read_text(encoding="utf-8").strip()
            await self.process_text(text)
            self.processed_files.add(file_path)
        except Exception as e:
            print(f"[错误] 处理文件 {file_path} 时发生错误: {str(e)}")

    async def scan_directory(self) -> List[Path]:
        """扫描目录获取新文件"""
        try:
            return [p for p in INPUT_DIR.glob("*.txt") if p not in self.processed_files]
        except Exception as e:
            print(f"[错误] 扫描目录时发生错误: {str(e)}")
            return []

    async def run(self):
        """运行文件监控循环"""
        print(f"监控目录中: {INPUT_DIR}...")
        print(f"使用Plutchik情感轮进行多维度情感分析")
        try:
            while True:
                new_files = await self.scan_directory()
                for file_path in new_files:
                    print(f"检测到新输入文件: {file_path.name}")
                    await self.process_file(file_path)
                await asyncio.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n程序已停止")


async def main():
    processor = VoiceProcessor()
    await processor.run()


if __name__ == "__main__":
    asyncio.run(main())
