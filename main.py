# main.py
import os
import asyncio
from speech_recognizer import SpeechRecognizer
from voice_processor import VoiceProcessor


async def main():
    # 创建情绪分析处理器
    emotion_processor = VoiceProcessor()

    # 创建语音识别器，并设置回调函数
    async def on_text_recognized(text: str):
        print(f"\n[识别到语音] {text}")
        await emotion_processor.process_text(text)

    # 从环境变量获取模型路径，如果不存在则使用默认值
    vosk_model_path = os.environ.get("AI_EMOTION_VOSK_MODEL", "vosk-model-small-cn")

    # 初始化语音识别器
    recognizer = SpeechRecognizer(
        model_path=vosk_model_path,  # 从环境变量读取模型路径
        on_text_callback=on_text_recognized,
    )

    print("启动语音情绪分析系统...")
    print("请开始说话，系统会自动识别并分析情绪...")
    print("按 Ctrl+C 停止程序")

    try:
        await recognizer.start()
    except KeyboardInterrupt:
        await recognizer.stop()
        print("\n程序已停止")


if __name__ == "__main__":
    asyncio.run(main())
