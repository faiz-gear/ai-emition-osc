import asyncio
from voice_processor import VoiceProcessor


async def test():
    processor = VoiceProcessor()
    await processor.process_text("我很开心")


if __name__ == "__main__":
    asyncio.run(test())
