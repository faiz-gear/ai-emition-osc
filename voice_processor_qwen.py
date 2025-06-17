# voice_processor_qwen.py - 针对Qwen2.5优化的情绪分析处理器（正则表达式版本）
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
NUM_PREDICT = int(
    os.environ.get("AI_EMOTION_NUM_PREDICT", "256")
)  # 减少预测长度，因为不需要JSON
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

        # 情绪映射 - 按照新模板的顺序
        self.emotion_mapping = {
            "joy": 0,
            "sadness": 1,
            "anger": 2,
            "fear": 3,
            "surprise": 4,
            "disgust": 5,
            "trust": 6,
            "anticipation": 7,
        }

        self.emotion_names = {
            "joy": "喜悦",
            "sadness": "悲伤",
            "anger": "愤怒",
            "fear": "恐惧",
            "surprise": "惊讶",
            "disgust": "厌恶",
            "trust": "信任",
            "anticipation": "期待",
        }

        # 初始化针对Qwen2.5优化的LLM（移除JSON格式限制）
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            num_ctx=NUM_CTX,
            num_predict=NUM_PREDICT,
            top_k=TOP_K,
            top_p=TOP_P,
            repeat_penalty=1.1,  # 减少重复
            stop=["\n\n", "输入：", "现在请分析"],  # 停止词
        )

        # 构建prompt - 直接使用模板
        template_with_text = EMOTION_PROMPT_TEMPLATE.replace("{{TEXT}}", "{text}")
        self.prompt = ChatPromptTemplate.from_template(template_with_text)
        self.emotion_chain = self.prompt | self.llm

    def parse_emotion_output(self, output: str) -> dict:
        """使用正则表达式解析情绪输出"""
        emotions = {
            "joy": 0.0,
            "sadness": 0.0,
            "anger": 0.0,
            "fear": 0.0,
            "surprise": 0.0,
            "disgust": 0.0,
            "trust": 0.0,
            "anticipation": 0.0,
        }

        try:
            # 正则表达式匹配格式：emotion|value
            pattern = r"(\w+)\|([0-9]*\.?[0-9]+)"
            matches = re.findall(pattern, output)

            if matches:
                for emotion, value in matches:
                    emotion = emotion.lower()
                    if emotion in emotions:
                        try:
                            parsed_value = float(value)
                            # 确保值在0-1范围内
                            emotions[emotion] = round(
                                max(0.0, min(1.0, parsed_value)), 2
                            )
                        except ValueError:
                            print(f"[警告] 无法解析情绪值: {emotion}|{value}")

            else:
                print(f"[警告] 未找到匹配的情绪格式，尝试备用解析")
                # 备用解析方案 - 寻找更宽松的模式
                backup_pattern = r"(\w+)[:|：|=]\s*([0-9]*\.?[0-9]+)"
                backup_matches = re.findall(backup_pattern, output)

                for emotion, value in backup_matches:
                    emotion = emotion.lower()
                    if emotion in emotions:
                        try:
                            parsed_value = float(value)
                            emotions[emotion] = round(
                                max(0.0, min(1.0, parsed_value)), 2
                            )
                        except ValueError:
                            continue

        except Exception as e:
            print(f"[错误] 解析情绪输出时发生错误: {str(e)}")
            print(f"[错误] 原始输出: {output}")

        return emotions

    def create_emotion_vector(self, emotions: dict) -> list:
        """将情绪字典转换为OSC向量（按照新模板的顺序）"""
        return [
            emotions["joy"],
            emotions["sadness"],
            emotions["anger"],
            emotions["fear"],
            emotions["surprise"],
            emotions["disgust"],
            emotions["trust"],
            emotions["anticipation"],
        ]

    def get_dominant_emotion(self, emotions: dict) -> tuple[str, float]:
        """获取主导情绪及其强度"""
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])
        return dominant_emotion

    async def process_text(self, text: str) -> None:
        """使用正则表达式处理文本并分析情绪"""
        if not text.strip():
            return

        try:
            # 情感分析 - 获取原始文本输出
            result = await self.emotion_chain.ainvoke({"text": text})

            # 提取实际的文本内容
            if hasattr(result, "content"):
                raw_output = result.content
            else:
                raw_output = str(result)

            print(f"\n[原始LLM输出]: {raw_output}")

            # 使用正则表达式解析情绪值
            emotions = self.parse_emotion_output(raw_output)

            # 创建情感向量
            emotion_vector = self.create_emotion_vector(emotions)

            # 发送到TouchDesigner
            self.osc_client.send_message("/emotion", emotion_vector)

            # 获取主导情绪
            dominant_emotion, dominant_intensity = self.get_dominant_emotion(emotions)

            # 打印结果
            print(f"\n[Qwen2.5正则解析情感分析]")
            print(f"识别文本: {text}")
            print(
                f"主要情感: {self.emotion_names[dominant_emotion]} (强度: {dominant_intensity})"
            )
            print(f"详细情感分析:")
            for emotion, intensity in emotions.items():
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
                    default_emotions = {
                        "joy": 0.0,
                        "sadness": 0.0,
                        "anger": 0.0,
                        "fear": 0.0,
                        "surprise": 0.0,
                        "disgust": 0.0,
                        "trust": 0.0,
                        "anticipation": 0.0,
                    }
                    default_vector = self.create_emotion_vector(default_emotions)
                    self.osc_client.send_message("/emotion", default_vector)
                    print(f"[信息] 发送默认情感向量: {default_vector}")
                except Exception as final_error:
                    print(f"[错误] 发送默认值时也发生错误: {final_error}")

    def _create_fallback_emotions(self, text: str) -> dict:
        """基于关键词的简单回退情感分析"""
        emotions = {
            "joy": 0.0,
            "sadness": 0.0,
            "anger": 0.0,
            "fear": 0.0,
            "surprise": 0.0,
            "disgust": 0.0,
            "trust": 0.0,
            "anticipation": 0.0,
        }
        text_lower = text.lower()

        # 简单的关键词匹配
        if any(word in text_lower for word in ["开心", "高兴", "愉快", "快乐", "兴奋"]):
            emotions["joy"] = 0.7
        elif any(word in text_lower for word in ["生气", "愤怒", "恼火", "气愤"]):
            emotions["anger"] = 0.7
        elif any(word in text_lower for word in ["难过", "悲伤", "伤心", "沮丧"]):
            emotions["sadness"] = 0.7
        elif any(word in text_lower for word in ["害怕", "恐惧", "紧张", "担心"]):
            emotions["fear"] = 0.7
        elif any(word in text_lower for word in ["惊讶", "意外", "震惊", "吃惊"]):
            emotions["surprise"] = 0.7
        elif any(word in text_lower for word in ["厌恶", "恶心", "讨厌", "反感"]):
            emotions["disgust"] = 0.7
        elif any(word in text_lower for word in ["期待", "期望", "盼望", "憧憬"]):
            emotions["anticipation"] = 0.7
        elif any(word in text_lower for word in ["信任", "相信", "依靠", "可靠"]):
            emotions["trust"] = 0.7
        else:
            # 如果没有明显情绪词，给一个微弱的正面情绪
            emotions["joy"] = 0.3

        return emotions
