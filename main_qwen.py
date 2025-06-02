# main_qwen.py - 使用Qwen2.5的主程序
import os
import asyncio
from speech_recognizer import SpeechRecognizer
from voice_processor_qwen import QwenVoiceProcessor
from dotenv import load_dotenv

load_dotenv()

print("=== AI中文语音情绪分析系统 (Qwen2.5版) ===")
print("模型：Qwen2.5 - 专门为中文优化的语言模型")

# 检查模型配置
current_model = os.environ.get("AI_EMOTION_LLM_MODEL", "qwen2.5:3b")
print(f"\n当前使用模型: {current_model}")

if "qwen2.5" not in current_model.lower():
    print("⚠️  警告：建议使用Qwen2.5模型以获得最佳中文情绪分析效果")
    print("可通过以下命令下载：ollama pull qwen2.5:3b")

print("\n当前环境变量：")
for key, value in os.environ.items():
    if key.startswith("AI_EMOTION_"):
        print(f"{key}: {value}")


async def main():
    # 创建Qwen2.5情绪分析处理器
    emotion_processor = QwenVoiceProcessor()

    # 创建语音识别器回调函数
    async def on_text_recognized(text: str):
        print(f"\n[语音识别] {text}")
        await emotion_processor.process_text(text)

    # 获取Vosk模型路径
    vosk_model_path = os.environ.get("AI_EMOTION_VOSK_MODEL", "vosk-model-small-cn")

    # 初始化语音识别器
    recognizer = SpeechRecognizer(
        model_path=vosk_model_path,
        on_text_callback=on_text_recognized,
    )

    print("\n启动Qwen2.5语音情绪分析系统...")
    print("✨ 特性：")
    print("  - 使用Qwen2.5:3b模型，专门优化中文理解")
    print("  - 快速响应，平均处理时间<1秒")
    print("  - 精确情绪识别，支持8种基础情绪")
    print("  - 优化的中文语气词和程度副词识别")
    print("\n🎯 支持的情绪类型：")
    print("  喜悦、悲伤、愤怒、恐惧、惊讶、厌恶、信任、期待")
    print("\n🎤 请开始说话，系统会自动识别并分析情绪...")
    print("按 Ctrl+C 停止程序")

    try:
        await recognizer.start()
    except KeyboardInterrupt:
        await recognizer.stop()
        print("\n程序已停止")


if __name__ == "__main__":
    asyncio.run(main())
