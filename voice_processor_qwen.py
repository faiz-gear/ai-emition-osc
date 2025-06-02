# voice_processor_qwen.py - 针对Qwen2.5优化的情绪分析处理器
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
LLM_MODEL = os.environ.get("AI_EMOTION_LLM_MODEL", "qwen2.5:3b")
LLM_TEMPERATURE = float(os.environ.get("AI_EMOTION_LLM_TEMPERATURE", "0.2"))

# Qwen2.5 特殊参数
NUM_CTX = int(os.environ.get("AI_EMOTION_NUM_CTX", "2048"))
NUM_PREDICT = int(os.environ.get("AI_EMOTION_NUM_PREDICT", "15"))
TOP_K = int(os.environ.get("AI_EMOTION_TOP_K", "20"))
TOP_P = float(os.environ.get("AI_EMOTION_TOP_P", "0.8"))

# 读取提示词模板
PROMPT_TEMPLATE_PATH = os.environ.get(
    "AI_EMOTION_PROMPT_TEMPLATE", "prompt_template_enhanced.txt"
)
with open(PROMPT_TEMPLATE_PATH, "r", encoding="utf-8") as f:
    EMOTION_PROMPT_TEMPLATE = f.read()


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

        # 初始化针对Qwen2.5优化的LLM
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            num_ctx=NUM_CTX,
            num_predict=NUM_PREDICT,
            top_k=TOP_K,
            top_p=TOP_P,
            repeat_penalty=1.1,  # 减少重复
            stop=["输入：", "现在请分析", "\n\n"],  # 添加停止词
        )

        self.prompt = ChatPromptTemplate.from_template(EMOTION_PROMPT_TEMPLATE)
        self.emotion_chain = self.prompt | self.llm

    def parse_emotion_output(self, output: str) -> str:
        """解析LLM输出格式：emotion|1，针对固定强度值1优化"""
        try:
            # 清理输出，移除可能的额外内容
            output = output.strip()
            lines = output.split("\n")

            # 寻找包含 | 的行
            for line in lines:
                line = line.strip()
                if "|" in line:
                    # 使用正则表达式提取情绪，现在期望强度值为1
                    pattern = r"(joy|trust|fear|surprise|sadness|disgust|anger|anticipation)\|1"
                    match = re.search(pattern, line.lower())

                    if match:
                        emotion = match.group(1)
                        return emotion

            # 如果没有找到标准格式，尝试从输出中提取情绪词
            output_lower = output.lower()

            # 按优先级搜索情绪词，增加更多中文关键词匹配
            emotion_keywords = {
                "joy": [
                    "joy",
                    "喜悦",
                    "开心",
                    "高兴",
                    "快乐",
                    "愉快",
                    "兴奋",
                    "满足",
                    "欣慰",
                ],
                "sadness": [
                    "sadness",
                    "悲伤",
                    "难过",
                    "失落",
                    "沮丧",
                    "痛苦",
                    "忧伤",
                    "哀伤",
                    "遗憾",
                ],
                "anger": [
                    "anger",
                    "愤怒",
                    "生气",
                    "烦躁",
                    "恼火",
                    "不满",
                    "愤恨",
                    "暴怒",
                ],
                "fear": [
                    "fear",
                    "恐惧",
                    "担心",
                    "害怕",
                    "焦虑",
                    "紧张",
                    "不安",
                    "恐慌",
                    "畏惧",
                ],
                "surprise": [
                    "surprise",
                    "惊讶",
                    "意外",
                    "震惊",
                    "诧异",
                    "惊奇",
                    "吃惊",
                    "惊愕",
                ],
                "disgust": [
                    "disgust",
                    "厌恶",
                    "反感",
                    "恶心",
                    "讨厌",
                    "嫌弃",
                    "厌烦",
                    "憎恶",
                    "排斥",
                ],
                "trust": [
                    "trust",
                    "信任",
                    "信赖",
                    "相信",
                    "依靠",
                    "确信",
                    "放心",
                    "可靠",
                    "信心",
                ],
                "anticipation": [
                    "anticipation",
                    "期待",
                    "期望",
                    "盼望",
                    "渴望",
                    "向往",
                    "期盼",
                    "憧憬",
                    "预期",
                ],
            }

            # 按照映射规则的优先级进行匹配
            priority_order = [
                "sadness",
                "joy",
                "fear",
                "anger",
                "disgust",
                "anticipation",
                "trust",
                "surprise",
            ]

            for emotion in priority_order:
                keywords = emotion_keywords[emotion]
                for keyword in keywords:
                    if keyword in output_lower:
                        return emotion

            return "joy"  # 最终默认返回

        except Exception as e:
            print(f"[警告] 解析情绪输出失败: {e}, 输出内容: {output}")
            return "joy"

    async def process_text(self, text: str) -> None:
        """使用Qwen2.5处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 情感分析
            result = await self.emotion_chain.ainvoke({"text": text})

            # 解析结果，现在只返回情绪类型
            emotion = self.parse_emotion_output(result.content)

            # 创建情感向量 - 固定强度为1.0
            emotion_vector = [0.0] * 8
            emotion_index = self.emotion_mapping[emotion]
            emotion_vector[emotion_index] = 1.0

            # 发送到TouchDesigner
            self.osc_client.send_message("/emotion", emotion_vector)

            # 打印结果
            print(f"\n[Qwen2.5情感分析]")
            print(f"识别文本: {text}")
            print(f"主要情感: {self.emotion_names[emotion]} (强度: 1.0)")
            print(f"OSC数据: {emotion_vector}")
            print(f"原始输出: {result.content}")

        except Exception as e:
            print(f"[错误] 处理文本时发生错误: {str(e)}")
            # 发送默认值
            default_vector = [0.0] * 8
            default_vector[0] = 1.0  # 默认为joy，强度1.0
            self.osc_client.send_message("/emotion", default_vector)
