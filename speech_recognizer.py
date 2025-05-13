# speech_recognizer.py
import queue
import json
import os
import sounddevice as sd
import numpy as np
from vosk import Model, KaldiRecognizer
import asyncio
from typing import Optional, Callable
import time


class SpeechRecognizer:
    def __init__(
        self,
        model_path: str = "vosk-model-small-cn",
        sample_rate: int = 16000,
        on_text_callback: Optional[Callable[[str], None]] = None,
    ):
        """
        初始化语音识别器

        Args:
            model_path: Vosk模型路径
            sample_rate: 采样率
            on_text_callback: 识别到文本时的回调函数
        """
        self.sample_rate = sample_rate
        self.model = Model(model_path)
        self.recognizer = KaldiRecognizer(self.model, sample_rate)
        self.recognizer.SetWords(True)  # 启用词级别时间戳
        self.audio_queue = queue.Queue()
        self.on_text_callback = on_text_callback

        # 从环境变量获取音频配置参数
        blocksize = int(os.environ.get("AI_EMOTION_BLOCKSIZE", "2000"))

        # 音频输入流配置
        self.stream = sd.InputStream(
            channels=1,
            dtype=np.int16,
            samplerate=sample_rate,
            callback=self._audio_callback,
            blocksize=blocksize,  # 缓冲区大小，影响延迟
        )

        self._is_running = False
        self._current_text = ""
        self._last_speech_time = time.time()

        # 从环境变量读取阈值配置
        self._silence_threshold = int(
            os.environ.get("AI_EMOTION_SILENCE_THRESHOLD", "500")
        )  # 静音阈值
        self._min_speech_duration = float(
            os.environ.get("AI_EMOTION_MIN_SPEECH_DURATION", "0.3")
        )  # 最小语音持续时间（秒）
        self._max_silence_duration = float(
            os.environ.get("AI_EMOTION_MAX_SILENCE_DURATION", "0.5")
        )  # 最大静音持续时间（秒）
        self._is_speaking = False

    def _audio_callback(self, indata, frames, time_info, status):
        """音频输入回调函数"""
        if status:
            print(f"音频输入状态: {status}")
        self.audio_queue.put(bytes(indata))

    def _is_silence(self, audio_data: bytes) -> bool:
        """检测是否为静音"""
        return (
            np.max(np.abs(np.frombuffer(audio_data, dtype=np.int16)))
            < self._silence_threshold
        )

    async def process_audio(self):
        """处理音频数据"""
        while self._is_running:
            try:
                # 非阻塞方式获取音频数据
                audio_data = self.audio_queue.get_nowait()
                current_time = time.time()

                # 检测是否有语音
                is_current_silence = self._is_silence(audio_data)

                if not is_current_silence:
                    self._last_speech_time = current_time
                    if not self._is_speaking:
                        self._is_speaking = True
                        self._current_text = ""

                # 处理语音识别
                if self.recognizer.AcceptWaveform(audio_data):
                    result = json.loads(self.recognizer.Result())
                    text = result.get("text", "").strip()
                    if text:
                        self._current_text = text
                        # 实时输出部分结果
                        if len(self._current_text) > 5:  # 积累一定长度再输出
                            if self.on_text_callback:
                                await self.on_text_callback(self._current_text)
                            self._current_text = ""

                # 检测语音段落结束
                if self._is_speaking and is_current_silence:
                    silence_duration = current_time - self._last_speech_time
                    if silence_duration > self._max_silence_duration:
                        self._is_speaking = False
                        # 处理剩余的文本
                        if self._current_text and self.on_text_callback:
                            await self.on_text_callback(self._current_text)
                            self._current_text = ""

            except queue.Empty:
                await asyncio.sleep(0.01)  # 减小睡眠时间
            except Exception as e:
                print(f"处理音频时出错: {str(e)}")
                await asyncio.sleep(0.01)

    async def start(self):
        """启动语音识别"""
        print("正在启动语音识别...")
        self._is_running = True
        self.stream.start()
        await self.process_audio()

    async def stop(self):
        """停止语音识别"""
        self._is_running = False
        self.stream.stop()
        self.stream.close()
        print("语音识别已停止")


async def test_recognizer():
    """测试函数"""

    async def on_text(text: str):
        print(f"识别到文本: {text}")

    recognizer = SpeechRecognizer(on_text_callback=on_text)
    try:
        await recognizer.start()
    except KeyboardInterrupt:
        await recognizer.stop()


if __name__ == "__main__":
    asyncio.run(test_recognizer())
