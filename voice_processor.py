# voice_processor.py
import os
import time
import asyncio
from typing import Optional, List, Dict, Any
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from pythonosc import udp_client
from dotenv import load_dotenv

load_dotenv()

# ============== 配置区 ==============
# 从环境变量读取配置，如果不存在则使用默认值
INPUT_DIR = Path(
    os.environ.get("AI_EMOTION_INPUT_DIR", "/opt/ai-emotion/input")
)  # 语音文件存放目录
OSC_IP = os.environ.get("AI_EMOTION_OSC_IP", "127.0.0.1")
OSC_PORT = int(os.environ.get("AI_EMOTION_OSC_PORT", "7000"))
POLL_INTERVAL = float(os.environ.get("AI_EMOTION_POLL_INTERVAL", "1"))  # 轮询间隔（秒）
LLM_MODEL = os.environ.get("AI_EMOTION_LLM_MODEL", "deepseek-r1:1.5b")
print(f"LLM_MODEL: {LLM_MODEL}")
LLM_TEMPERATURE = float(os.environ.get("AI_EMOTION_LLM_TEMPERATURE", "0.6"))
# ===================================

# 读取提示词模板
PROMPT_TEMPLATE_PATH = os.environ.get(
    "AI_EMOTION_PROMPT_TEMPLATE", "prompt_template.txt"
)
with open(PROMPT_TEMPLATE_PATH, "r", encoding="utf-8") as f:
    EMOTION_PROMPT_TEMPLATE = f.read()

# 情感名称映射表（仅用于日志显示）
EMOTION_NAMES = {
    1: "喜悦(joy)",
    2: "信任(trust)",
    3: "恐惧(fear)",
    4: "惊讶(surprise)",
    5: "悲伤(sadness)",
    6: "厌恶(disgust)",
    7: "愤怒(anger)",
    8: "期待(anticipation)",
}


class VoiceProcessor:
    def __init__(self):
        self.osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)
        self.processed_files = set()

        # 构建提示模板
        self.prompt = ChatPromptTemplate.from_template(template=EMOTION_PROMPT_TEMPLATE)

        # 初始化LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            callbacks=[StreamingStdOutCallbackHandler()],
        )

        # 创建情感分析链
        self.emotion_chain = self.prompt | self.llm

    async def process_text(self, text: str) -> None:
        """直接处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 使用LLM分析情感
            response = await self.emotion_chain.ainvoke({"text": text})

            # 提取模型输出的情感编号（假设模型直接输出1-8的数字）
            # 清理输出，移除可能的空格和其他文本
            emotion_code_str = response.content.strip()

            # 提取数字（移除可能的额外文本）
            import re

            emotion_code_match = re.search(r"\b[1-8]\b", emotion_code_str)

            if emotion_code_match:
                emotion_code = int(emotion_code_match.group())

                # 数字验证（确保在1-8范围内）
                if 1 <= emotion_code <= 8:
                    # 发送情感编码到TouchDesigner
                    self.osc_client.send_message("/emotion", [emotion_code])

                    # 打印分析结果
                    print(f"\n[情感分析结果]")
                    print(
                        f"情感编码: {emotion_code} - {EMOTION_NAMES.get(emotion_code, '未知')}"
                    )
                else:
                    print(f"[警告] 接收到超出范围的情感编码: {emotion_code}")
            else:
                print(f"[警告] 无法从输出中提取情感编码: '{emotion_code_str}'")

        except Exception as e:
            print(f"[错误] 处理文本时发生错误: {str(e)}")
            import traceback

            traceback.print_exc()

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
        print(f"使用简化的情感分析流程，直接输出情感编码(1-8)")
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
