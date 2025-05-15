# voice_processor.py
import os
import time
import asyncio
from typing import Optional, List, Dict, Any
from pathlib import Path
from pydantic import BaseModel, Field, field_validator, validator
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from pythonosc import udp_client
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnablePassthrough

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

    @field_validator("*")
    def check_values(cls, v):
        return round(max(0.0, min(1.0, v)), 2)


class EmotionAnalysis(BaseModel):
    """多维度情感分析结果的结构化输出模型"""

    dimensions: EmotionDimensions = Field(description="Plutchik情感轮的八种情感维度")
    dominant_emotion: str = Field(
        description="最主要的情感，如果所有情感都低于阈值则为neutral"
    )
    brief_explanation: str = Field(description="对情感分析的简短解释，不超过100字")


class VoiceProcessor:
    def __init__(self):
        self.osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)
        self.processed_files = set()

        # 初始化PydanticOutputParser
        self.parser = PydanticOutputParser(pydantic_object=EmotionAnalysis)

        # 构建提示模板，包含解析器格式说明
        prompt_template = EMOTION_PROMPT_TEMPLATE + "\n{format_instructions}"
        self.prompt = ChatPromptTemplate.from_template(
            template=prompt_template,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        # 初始化LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            callbacks=[StreamingStdOutCallbackHandler()],
        ).with_structured_output(EmotionAnalysis)

        # 使用LCEL创建情感分析链 - 修改为正确的链结构
        self.emotion_chain = self.prompt | self.llm

    async def process_text(self, text: str) -> None:
        """直接处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 使用修改后的LCEL链进行情感分析
            result = await self.emotion_chain.ainvoke({"text": text})

            # 获取情感维度数据
            dimensions = result.dimensions.model_dump()

            # 找出强度最大的情感
            emotion_mapping = {
                "joy": 1,  # 喜悦
                "trust": 2,  # 信任
                "fear": 3,  # 恐惧
                "surprise": 4,  # 惊讶
                "sadness": 5,  # 悲伤
                "disgust": 6,  # 厌恶
                "anger": 7,  # 愤怒
                "anticipation": 8,  # 期待
            }

            # 找出强度值最大的情感
            max_emotion = max(dimensions.items(), key=lambda x: x[1])
            max_emotion_name, max_emotion_value = max_emotion

            # 将最大情感映射为1-8
            max_emotion_code = emotion_mapping[max_emotion_name]

            # 发送强度最大的情感编码到TouchDesigner
            self.osc_client.send_message("/emotion", [max_emotion_code])

            # 打印分析结果
            print(f"\n[情感分析结果]")
            print(f"主要情感: {result.dominant_emotion}")
            print(
                f"最强情感: {max_emotion_name} (强度: {max_emotion_value:.2f}, 编码: {max_emotion_code})"
            )
            for emotion, value in dimensions.items():
                print(f"{emotion}: {value:.2f}")
            print(f"解释: {result.brief_explanation}")

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
