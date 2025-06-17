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

    joy: float = Field(default=0.0, ge=0.0, le=1.0, description="喜悦情绪强度，范围0-1")
    trust: float = Field(
        default=0.0, ge=0.0, le=1.0, description="信任情绪强度，范围0-1"
    )
    fear: float = Field(
        default=0.0, ge=0.0, le=1.0, description="恐惧情绪强度，范围0-1"
    )
    surprise: float = Field(
        default=0.0, ge=0.0, le=1.0, description="惊讶情绪强度，范围0-1"
    )
    sadness: float = Field(
        default=0.0, ge=0.0, le=1.0, description="悲伤情绪强度，范围0-1"
    )
    disgust: float = Field(
        default=0.0, ge=0.0, le=1.0, description="厌恶情绪强度，范围0-1"
    )
    anger: float = Field(
        default=0.0, ge=0.0, le=1.0, description="愤怒情绪强度，范围0-1"
    )
    anticipation: float = Field(
        default=0.0, ge=0.0, le=1.0, description="期待情绪强度，范围0-1"
    )

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
            """请严格按照JSON格式输出所有8种情绪各自的强度值（0 - 1）。
            
必须包含以下所有字段：joy, trust, fear, surprise, sadness, disgust, anger, anticipation

示例输出格式：
{
    "joy": 0.8,
    "trust": 0.0,
    "fear": 0.0,
    "surprise": 0.0,
    "sadness": 0.0,
    "disgust": 0.0,
    "anger": 0.0,
    "anticipation": 0.2
}

请确保输出包含所有8个字段，即使某些情绪强度为0也必须明确列出。""",
        )

        # 使用ChatPromptTemplate.from_messages来避免格式指令中的大括号问题
        from langchain_core.messages import HumanMessage, SystemMessage

        self.prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=f"你是专业的情绪分析AI。{format_instructions}"),
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

            # 尝试使用简化的回退方案
            try:
                print("[信息] 尝试使用回退方案...")
                fallback_emotions = self._create_fallback_emotions(text)
                fallback_vector = self.create_emotion_vector(fallback_emotions)
                self.osc_client.send_message("/emotion", fallback_vector)
                print(f"[信息] 使用回退情感分析结果: {fallback_vector}")

            except Exception as fallback_error:
                print(f"[错误] 回退方案也失败: {fallback_error}")
                # 最终的默认值
                try:
                    default_emotions = EmotionDimensions()  # 使用默认值
                    default_vector = self.create_emotion_vector(default_emotions)
                    self.osc_client.send_message("/emotion", default_vector)
                    print(f"[信息] 发送默认情感向量: {default_vector}")
                except Exception as final_error:
                    print(f"[错误] 发送默认值时也发生错误: {final_error}")

    def _create_fallback_emotions(self, text: str) -> EmotionDimensions:
        """基于关键词的简单回退情感分析"""
        emotions = EmotionDimensions()  # 全部使用默认值0.0
        text_lower = text.lower()

        # 简单的关键词匹配
        if any(word in text_lower for word in ["开心", "高兴", "愉快", "快乐", "兴奋"]):
            emotions.joy = 0.7
        elif any(word in text_lower for word in ["生气", "愤怒", "恼火", "气愤"]):
            emotions.anger = 0.7
        elif any(word in text_lower for word in ["难过", "悲伤", "伤心", "沮丧"]):
            emotions.sadness = 0.7
        elif any(word in text_lower for word in ["害怕", "恐惧", "紧张", "担心"]):
            emotions.fear = 0.7
        elif any(word in text_lower for word in ["惊讶", "意外", "震惊", "吃惊"]):
            emotions.surprise = 0.7
        elif any(word in text_lower for word in ["厌恶", "恶心", "讨厌", "反感"]):
            emotions.disgust = 0.7
        elif any(word in text_lower for word in ["期待", "期望", "盼望", "憧憬"]):
            emotions.anticipation = 0.7
        elif any(word in text_lower for word in ["信任", "相信", "依靠", "可靠"]):
            emotions.trust = 0.7
        else:
            # 如果没有明显情绪词，给一个微弱的正面情绪
            emotions.joy = 0.3

        return emotions
