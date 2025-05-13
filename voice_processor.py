# voice_processor.py
import os
import time
import asyncio
from typing import Optional, List
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain_core.output_parsers import JsonOutputParser
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from pythonosc import udp_client

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


class EmotionAnalysis(BaseModel):
    """情绪分析结果的结构化输出模型"""

    emotion_value: float = Field(
        description="从-1到1的情绪值，-1表示极度消极，0表示中性，1表示极度积极"
    )
    brief_explanation: str = Field(description="对情绪分析的简短解释，不超过100字")


class VoiceProcessor:
    def __init__(self):
        self.osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)
        self.processed_files = set()

        # 初始化LangChain组件
        self.parser = JsonOutputParser(pydantic_object=EmotionAnalysis)

        # 构建提示模板
        self.prompt = ChatPromptTemplate.from_template(EMOTION_PROMPT_TEMPLATE)

        # 初始化LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]),
        )

        # 构建LCEL链
        self.chain = self.prompt | self.llm | self.parser

    async def process_text(self, text: str) -> None:
        """直接处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 使用LCEL链进行处理
            result = await self.chain.ainvoke({"用户输入文本": text})

            # 发送数据到TouchDesigner
            self.osc_client.send_message("/emotion", [result.emotion_value])
            print(f"[情绪分析] 情绪值: {result.emotion_value:.2f}")
            print(f"[情绪解释] {result.brief_explanation}")

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
