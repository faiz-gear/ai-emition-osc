# voice_processor_qwen.py - 针对Qwen2.5优化的情绪分析处理器
import os
import re
import asyncio
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_ollama import ChatOllama
from pythonosc import udp_client
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

load_dotenv()

# 配置
OSC_IP = os.environ.get("AI_EMOTION_OSC_IP", "127.0.0.1")
OSC_PORT = int(os.environ.get("AI_EMOTION_OSC_PORT", "7000"))
LLM_MODEL = os.environ.get("AI_EMOTION_LLM_MODEL", "qwen2.5:3b")
LLM_TEMPERATURE = float(os.environ.get("AI_EMOTION_LLM_TEMPERATURE", "0.2"))

# Qwen2.5 特殊参数
NUM_CTX = int(os.environ.get("AI_EMOTION_NUM_CTX", "2048"))
NUM_PREDICT = int(
    os.environ.get("AI_EMOTION_NUM_PREDICT", "512")
)  # 增加预测长度以支持JSON输出
TOP_K = int(os.environ.get("AI_EMOTION_TOP_K", "20"))
TOP_P = float(os.environ.get("AI_EMOTION_TOP_P", "0.8"))

# 读取提示词模板
PROMPT_TEMPLATE_PATH = os.environ.get(
    "AI_EMOTION_PROMPT_TEMPLATE", "prompt_template_enhanced.txt"
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
        return round(max(0.0, min(1.0, v)), 1)


class QwenVoiceProcessor:
    def __init__(self):
        self.osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)

        # 情绪映射
        self.emotion_mapping = {
            "joy": 0,
            "trust": 1,
            "fear": 2,
            "surprise": 3,
            "sadness": 4,
            "disgust": 5,
            "anger": 6,
            "anticipation": 7,
        }

        self.emotion_names = {
            "joy": "喜悦",
            "trust": "信任",
            "fear": "恐惧",
            "surprise": "惊讶",
            "sadness": "悲伤",
            "disgust": "厌恶",
            "anger": "愤怒",
            "anticipation": "期待",
        }

        # 创建输出解析器
        self.output_parser = PydanticOutputParser(pydantic_object=EmotionDimensions)

        # 初始化针对Qwen2.5优化的LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            num_ctx=NUM_CTX,
            num_predict=NUM_PREDICT,
            top_k=TOP_K,
            top_p=TOP_P,
            repeat_penalty=1.1,  # 减少重复
            stop=["\n\n", "输入：", "现在请分析"],  # 停止词
            format="json",  # 强制JSON格式输出
        )

        # 构建包含格式指令的prompt - 使用更安全的方法
        format_instructions = self.output_parser.get_format_instructions()

        # 先替换TEXT占位符
        template_with_text = EMOTION_PROMPT_TEMPLATE.replace("{{TEXT}}", "{text}")

        # 创建两步骤的prompt：基础模板 + 单独的格式指令
        # 将格式指令作为系统消息而不是直接插入模板
        base_template = template_with_text.replace(
            "请严格按照后续Langchain的PydanticOutputParser指定的格式输出8种情绪各自的强度值（0 - 1）。",
            "请严格按照JSON格式输出8种情绪各自的强度值（0 - 1），输出格式要求将在后续消息中说明。",
        )

        # 使用ChatPromptTemplate.from_messages来避免格式指令中的大括号问题
        from langchain_core.messages import HumanMessage, SystemMessage

        self.prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=f"格式要求: {format_instructions}"),
                HumanMessage(content=base_template),
            ]
        )
        self.emotion_chain = self.prompt | self.llm | self.output_parser

    def create_emotion_vector(self, emotions: EmotionDimensions) -> list:
        """将EmotionDimensions对象转换为OSC向量"""
        return [
            emotions.joy,
            emotions.trust,
            emotions.fear,
            emotions.surprise,
            emotions.sadness,
            emotions.disgust,
            emotions.anger,
            emotions.anticipation,
        ]

    def get_dominant_emotion(self, emotions: EmotionDimensions) -> tuple[str, float]:
        """获取主导情绪及其强度"""
        emotion_dict = emotions.model_dump()
        dominant_emotion = max(emotion_dict.items(), key=lambda x: x[1])
        return dominant_emotion

    async def process_text(self, text: str) -> None:
        """使用Qwen2.5和结构化输出处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 情感分析 - 使用结构化输出
            emotions = await self.emotion_chain.ainvoke({"text": text})

            # 创建情感向量
            emotion_vector = self.create_emotion_vector(emotions)

            # 发送到TouchDesigner
            self.osc_client.send_message("/emotion", emotion_vector)

            # 获取主导情绪
            dominant_emotion, dominant_intensity = self.get_dominant_emotion(emotions)

            # 打印结果
            print(f"\n[Qwen2.5结构化情感分析]")
            print(f"识别文本: {text}")
            print(
                f"主要情感: {self.emotion_names[dominant_emotion]} (强度: {dominant_intensity})"
            )
            print(f"详细情感分析:")
            for emotion, intensity in emotions.model_dump().items():
                if intensity > 0:
                    print(f"  {self.emotion_names[emotion]}: {intensity}")
            print(f"OSC数据: {emotion_vector}")

        except Exception as e:
            print(f"[错误] 处理文本时发生错误: {str(e)}")
            # 发送默认值 - 创建默认的EmotionDimensions对象
            try:
                default_emotions = EmotionDimensions(
                    joy=0.5,
                    trust=0.0,
                    fear=0.0,
                    surprise=0.0,
                    sadness=0.0,
                    disgust=0.0,
                    anger=0.0,
                    anticipation=0.0,
                )
                default_vector = self.create_emotion_vector(default_emotions)
                self.osc_client.send_message("/emotion", default_vector)
                print(f"[信息] 发送默认情感向量: {default_vector}")
            except Exception as fallback_error:
                print(f"[错误] 发送默认值时也发生错误: {fallback_error}")
