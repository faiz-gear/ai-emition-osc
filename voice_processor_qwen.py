# voice_processor_qwen.py - 针对Qwen2.5优化的情绪分析处理器（正则表达式版本）
import os
import re
import asyncio
import time
import uuid
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

# 默认情绪值配置 - 当所有情绪都为0时使用
DEFAULT_EMOTION_VALUE = float(os.environ.get("AI_EMOTION_DEFAULT_VALUE", "0.15"))

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
        self.session_id = str(uuid.uuid4())[:8]  # 会话ID用于日志追溯
        self.request_counter = 0  # 请求计数器

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

        self._log_info(
            f"初始化完成 - 会话ID: {self.session_id}, 默认情绪值: {DEFAULT_EMOTION_VALUE}"
        )

    def _get_timestamp(self) -> str:
        """获取格式化的时间戳"""
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    def _log_info(self, message: str, request_id: str = None):
        """记录信息日志"""
        timestamp = self._get_timestamp()
        session_info = f"[{self.session_id}]"
        request_info = f"[{request_id}]" if request_id else ""
        print(f"{timestamp} {session_info}{request_info} [INFO] {message}")

    def _log_warning(self, message: str, request_id: str = None):
        """记录警告日志"""
        timestamp = self._get_timestamp()
        session_info = f"[{self.session_id}]"
        request_info = f"[{request_id}]" if request_id else ""
        print(f"{timestamp} {session_info}{request_info} [WARN] {message}")

    def _log_error(self, message: str, request_id: str = None):
        """记录错误日志"""
        timestamp = self._get_timestamp()
        session_info = f"[{self.session_id}]"
        request_info = f"[{request_id}]" if request_id else ""
        print(f"{timestamp} {session_info}{request_info} [ERROR] {message}")

    def _check_all_zero_emotions(self, emotions: dict) -> bool:
        """检查是否所有情绪值都为0"""
        return all(value == 0.0 for value in emotions.values())

    def _create_default_emotions(self) -> dict:
        """创建默认情绪值（所有情绪都使用默认值）"""
        return {
            "joy": DEFAULT_EMOTION_VALUE,
            "sadness": DEFAULT_EMOTION_VALUE,
            "anger": DEFAULT_EMOTION_VALUE,
            "fear": DEFAULT_EMOTION_VALUE,
            "surprise": DEFAULT_EMOTION_VALUE,
            "disgust": DEFAULT_EMOTION_VALUE,
            "trust": DEFAULT_EMOTION_VALUE,
            "anticipation": DEFAULT_EMOTION_VALUE,
        }

    def parse_emotion_output(self, output: str, request_id: str = None) -> dict:
        """使用正则表达式解析情绪输出，适配新版prompt格式"""
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
            # 新版prompt格式：每行为 emotion: value
            # 支持: joy: 0.0、joy：0.0、joy=0.0
            pattern = r"(joy|sadness|anger|fear|surprise|disgust|trust|anticipation)\s*[:：=]\s*([0-9]*\.?[0-9]+)"
            matches = re.findall(pattern, output, re.IGNORECASE)

            if matches:
                self._log_info(f"找到 {len(matches)} 个情绪匹配项", request_id)
                for emotion, value in matches:
                    emotion = emotion.lower()
                    if emotion in emotions:
                        try:
                            parsed_value = float(value)
                            # 确保值在0-1范围内
                            emotions[emotion] = round(
                                max(0.0, min(1.0, parsed_value)), 2
                            )
                            self._log_info(
                                f"解析情绪: {emotion} = {emotions[emotion]}", request_id
                            )
                        except ValueError:
                            self._log_warning(
                                f"无法解析情绪值: {emotion}:{value}", request_id
                            )
            else:
                self._log_warning("未找到匹配的情绪格式，尝试备用解析", request_id)
                # 备用解析方案 - 支持更宽松的分隔符
                backup_pattern = r"(joy|sadness|anger|fear|surprise|disgust|trust|anticipation)\s*[:|：|=]\s*([0-9]*\.?[0-9]+)"
                backup_matches = re.findall(backup_pattern, output, re.IGNORECASE)

                if backup_matches:
                    self._log_info(
                        f"备用解析找到 {len(backup_matches)} 个匹配项", request_id
                    )
                    for emotion, value in backup_matches:
                        emotion = emotion.lower()
                        if emotion in emotions:
                            try:
                                parsed_value = float(value)
                                emotions[emotion] = round(
                                    max(0.0, min(1.0, parsed_value)), 2
                                )
                                self._log_info(
                                    f"备用解析情绪: {emotion} = {emotions[emotion]}",
                                    request_id,
                                )
                            except ValueError:
                                self._log_warning(
                                    f"备用解析失败: {emotion}:{value}", request_id
                                )
                                continue
                else:
                    self._log_warning("备用解析也未找到匹配项", request_id)

        except Exception as e:
            self._log_error(f"解析情绪输出时发生错误: {str(e)}", request_id)
            self._log_error(f"原始输出: {output}", request_id)

        # 检查是否所有情绪都为0
        if self._check_all_zero_emotions(emotions):
            self._log_warning("检测到所有情绪值都为0，使用默认情绪值", request_id)
            emotions = self._create_default_emotions()
            self._log_info(f"应用默认情绪值: {DEFAULT_EMOTION_VALUE}", request_id)

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

        # 生成唯一的请求ID
        self.request_counter += 1
        request_id = f"REQ{self.request_counter:03d}"

        self._log_info(f"开始处理文本: '{text}'", request_id)

        try:
            # 情感分析 - 获取原始文本输出
            self._log_info("调用LLM进行情感分析", request_id)
            result = await self.emotion_chain.ainvoke({"text": text})

            # 提取实际的文本内容
            if hasattr(result, "content"):
                raw_output = result.content
            else:
                raw_output = str(result)

            self._log_info(f"LLM原始输出: {raw_output}", request_id)

            # 使用正则表达式解析情绪值
            emotions = self.parse_emotion_output(raw_output, request_id)

            # 创建情感向量
            emotion_vector = self.create_emotion_vector(emotions)
            self._log_info(f"生成OSC向量: {emotion_vector}", request_id)

            # 发送到TouchDesigner
            try:
                self.osc_client.send_message("/emotion", emotion_vector)
                self._log_info("OSC消息发送成功", request_id)
            except Exception as osc_error:
                self._log_error(f"OSC消息发送失败: {str(osc_error)}", request_id)

            # 获取主导情绪
            dominant_emotion, dominant_intensity = self.get_dominant_emotion(emotions)

            # 打印结果摘要
            self._log_info(
                f"分析完成 - 主要情感: {self.emotion_names[dominant_emotion]} (强度: {dominant_intensity})",
                request_id,
            )

            # 详细情感分析结果
            active_emotions = {k: v for k, v in emotions.items() if v > 0}
            if active_emotions:
                emotion_details = ", ".join(
                    [
                        f"{self.emotion_names[k]}: {v}"
                        for k, v in active_emotions.items()
                    ]
                )
                self._log_info(f"活跃情绪: {emotion_details}", request_id)
            else:
                self._log_info("无活跃情绪", request_id)

        except Exception as e:
            self._log_error(f"处理文本时发生错误: {str(e)}", request_id)

            # 尝试使用简化的回退方案
            try:
                self._log_info("尝试使用关键词回退方案", request_id)
                fallback_emotions = self._create_fallback_emotions(text, request_id)
                fallback_vector = self.create_emotion_vector(fallback_emotions)

                self.osc_client.send_message("/emotion", fallback_vector)
                self._log_info(
                    f"回退方案执行成功，发送向量: {fallback_vector}", request_id
                )

            except Exception as fallback_error:
                self._log_error(f"回退方案也失败: {fallback_error}", request_id)
                # 最终的默认值
                try:
                    default_emotions = self._create_default_emotions()
                    default_vector = self.create_emotion_vector(default_emotions)
                    self.osc_client.send_message("/emotion", default_vector)
                    self._log_info(f"发送最终默认向量: {default_vector}", request_id)
                except Exception as final_error:
                    self._log_error(
                        f"发送默认值时也发生错误: {final_error}", request_id
                    )

    def _create_fallback_emotions(self, text: str, request_id: str = None) -> dict:
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
            self._log_info("关键词匹配: 喜悦情绪", request_id)
        elif any(word in text_lower for word in ["生气", "愤怒", "恼火", "气愤"]):
            emotions["anger"] = 0.7
            self._log_info("关键词匹配: 愤怒情绪", request_id)
        elif any(word in text_lower for word in ["难过", "悲伤", "伤心", "沮丧"]):
            emotions["sadness"] = 0.7
            self._log_info("关键词匹配: 悲伤情绪", request_id)
        elif any(word in text_lower for word in ["害怕", "恐惧", "紧张", "担心"]):
            emotions["fear"] = 0.7
            self._log_info("关键词匹配: 恐惧情绪", request_id)
        elif any(word in text_lower for word in ["惊讶", "意外", "震惊", "吃惊"]):
            emotions["surprise"] = 0.7
            self._log_info("关键词匹配: 惊讶情绪", request_id)
        elif any(word in text_lower for word in ["厌恶", "恶心", "讨厌", "反感"]):
            emotions["disgust"] = 0.7
            self._log_info("关键词匹配: 厌恶情绪", request_id)
        elif any(word in text_lower for word in ["期待", "期望", "盼望", "憧憬"]):
            emotions["anticipation"] = 0.7
            self._log_info("关键词匹配: 期待情绪", request_id)
        elif any(word in text_lower for word in ["信任", "相信", "依靠", "可靠"]):
            emotions["trust"] = 0.7
            self._log_info("关键词匹配: 信任情绪", request_id)
        else:
            # 如果没有明显情绪词，给一个微弱的正面情绪
            emotions["joy"] = 0.15
            self._log_info("无明显情绪关键词，使用默认微弱正面情绪", request_id)

        return emotions
