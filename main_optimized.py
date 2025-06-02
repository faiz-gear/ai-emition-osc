# main_optimized.py - 优化版主程序
import os
import asyncio
from speech_recognizer import SpeechRecognizer
from voice_processor_fast import FastVoiceProcessor
from dotenv import load_dotenv

load_dotenv()

# 推荐的环境变量设置
RECOMMENDED_SETTINGS = {
    "AI_EMOTION_LLM_MODEL": "deepseek-r1:1.5b",  # 或 qwen2.5:3b
    "AI_EMOTION_LLM_TEMPERATURE": "0.3",
    "AI_EMOTION_PROMPT_TEMPLATE": "prompt_template_enhanced.txt",
}

print("=== AI中文语音情绪分析系统 (优化版) ===")
print("\n推荐配置：")
for key, value in RECOMMENDED_SETTINGS.items():
    current_value = os.environ.get(key, "未设置")
    print(f"{key}: {current_value}")
    if current_value != value:
        print(f"  推荐值: {value}")

print("\n当前环境变量：")
for key, value in os.environ.items():
    if key.startswith("AI_EMOTION_"):
        print(f"{key}: {value}")


async def main():
    # 创建优化的情绪分析处理器
    emotion_processor = FastVoiceProcessor()

    # 创建语音识别器，并设置回调函数
    async def on_text_recognized(text: str):
        print(f"\n[语音识别] {text}")
        await emotion_processor.process_text(text)

    # 从环境变量获取模型路径
    vosk_model_path = os.environ.get("AI_EMOTION_VOSK_MODEL", "vosk-model-small-cn")

    # 初始化语音识别器
    recognizer = SpeechRecognizer(
        model_path=vosk_model_path,
        on_text_callback=on_text_recognized,
    )

    print("\n启动优化版语音情绪分析系统...")
    print("特性：")
    print("- 使用轻量级模型提高响应速度")
    print("- 增强版中文情绪分析")
    print("- 支持8种基础情绪：喜悦、悲伤、愤怒、恐惧、惊讶、厌恶、信任、期待")
    print("\n请开始说话，系统会自动识别并分析情绪...")
    print("按 Ctrl+C 停止程序")

    try:
        await recognizer.start()
    except KeyboardInterrupt:
        await recognizer.stop()
        print("\n程序已停止")


if __name__ == "__main__":
    asyncio.run(main())
