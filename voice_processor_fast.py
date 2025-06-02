# voice_processor_fast.py - 优化版情绪分析处理器
import os
import re
import asyncio
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from pythonosc import udp_client
from dotenv import load_dotenv

load_dotenv()

# 配置
OSC_IP = os.environ.get("AI_EMOTION_OSC_IP", "127.0.0.1")
OSC_PORT = int(os.environ.get("AI_EMOTION_OSC_PORT", "7000"))
LLM_MODEL = os.environ.get("AI_EMOTION_LLM_MODEL", "deepseek-r1:1.5b")
LLM_TEMPERATURE = float(
    os.environ.get("AI_EMOTION_LLM_TEMPERATURE", "0.3")
)  # 降低温度提高稳定性

# 读取简化提示词模板
PROMPT_TEMPLATE_PATH = os.environ.get(
    "AI_EMOTION_PROMPT_TEMPLATE", "prompt_template_simple.txt"
)
with open(PROMPT_TEMPLATE_PATH, "r", encoding="utf-8") as f:
    EMOTION_PROMPT_TEMPLATE = f.read()


class FastVoiceProcessor:
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

        # 初始化简化的LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            num_ctx=1024,  # 减少上下文长度
            num_predict=20,  # 限制输出长度
        )

        self.prompt = ChatPromptTemplate.from_template(EMOTION_PROMPT_TEMPLATE)
        self.emotion_chain = self.prompt | self.llm

    def parse_emotion_output(self, output: str) -> tuple:
        """解析LLM输出格式：emotion|value"""
        try:
            # 清理输出
            output = output.strip()

            # 使用正则表达式提取情绪和数值
            pattern = r"(joy|trust|fear|surprise|sadness|disgust|anger|anticipation)\|(\d+\.?\d*)"
            match = re.search(pattern, output.lower())

            if match:
                emotion = match.group(1)
                value = float(match.group(2))
                return emotion, min(1.0, max(0.0, value))
            else:
                # 如果解析失败，尝试从输出中提取情绪词
                for emotion in self.emotion_mapping.keys():
                    if emotion in output.lower():
                        return emotion, 0.6  # 默认中等强度
                return "joy", 0.5  # 默认返回
        except Exception as e:
            print(f"[警告] 解析情绪输出失败: {e}, 输出内容: {output}")
            return "joy", 0.5

    async def process_text(self, text: str) -> None:
        """快速处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 快速情感分析
            result = await self.emotion_chain.ainvoke({"text": text})

            # 解析结果
            emotion, intensity = self.parse_emotion_output(result.content)

            # 创建情感向量 - 使用连续值而非二进制
            emotion_vector = [0.0] * 8
            emotion_index = self.emotion_mapping[emotion]
            emotion_vector[emotion_index] = intensity

            # 发送到TouchDesigner
            self.osc_client.send_message("/emotion", emotion_vector)

            # 打印结果
            print(f"\n[快速情感分析]")
            print(f"识别文本: {text}")
            print(f"主要情感: {self.emotion_names[emotion]} (强度: {intensity:.1f})")
            print(f"OSC数据: {emotion_vector}")

        except Exception as e:
            print(f"[错误] 处理文本时发生错误: {str(e)}")
            # 发送默认值
            default_vector = [0.0] * 8
            default_vector[0] = 0.5  # 默认为中性喜悦
            self.osc_client.send_message("/emotion", default_vector)
