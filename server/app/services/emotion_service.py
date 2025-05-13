import os
from pathlib import Path
from typing import Optional
from pythonosc import udp_client
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_core.output_parsers import JsonOutputParser
from app.models.emotion import EmotionAnalysis, EmotionDimensions


class EmotionService:
    """Service for handling emotion analysis"""

    def __init__(self):
        # Initialize OSC client
        self.osc_ip = os.environ.get("AI_EMOTION_OSC_IP", "127.0.0.1")
        self.osc_port = int(os.environ.get("AI_EMOTION_OSC_PORT", "7000"))
        self.osc_client = udp_client.SimpleUDPClient(self.osc_ip, self.osc_port)
        self.osc_enabled = (
            os.environ.get("AI_EMOTION_OSC_ENABLED", "true").lower() == "true"
        )

        # Initialize LangChain components
        self.parser = JsonOutputParser(pydantic_object=EmotionAnalysis)

        # Read prompt template
        prompt_template_path = os.environ.get(
            "AI_EMOTION_PROMPT_TEMPLATE", "prompt_template.txt"
        )
        with open(prompt_template_path, "r", encoding="utf-8") as f:
            emotion_prompt_template = f.read()

        # Build prompt template
        self.prompt = ChatPromptTemplate.from_template(emotion_prompt_template)

        # Initialize LLM
        self.llm_model = os.environ.get("AI_EMOTION_LLM_MODEL", "deepseek-r1:1.5b")
        self.llm_temperature = float(
            os.environ.get("AI_EMOTION_LLM_TEMPERATURE", "0.6")
        )

        self.llm = ChatOllama(
            model=self.llm_model,
            temperature=self.llm_temperature,
            callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]),
        )

    async def analyze_text(self, text: str) -> EmotionAnalysis:
        """Analyze the emotional content of a text"""
        if not text.strip():
            # Return neutral result for empty text
            return EmotionAnalysis(
                dimensions=EmotionDimensions(
                    joy=0.0,
                    trust=0.0,
                    fear=0.0,
                    surprise=0.0,
                    sadness=0.0,
                    disgust=0.0,
                    anger=0.0,
                    anticipation=0.0,
                ),
                dominant_emotion="neutral",
                brief_explanation="Empty text provided",
            )

        try:
            # Use LLM for emotion analysis
            llm_response = await self.llm.agenerate(
                [self.prompt.format(用户输入文本=text)]
            )
            result = self.parser.parse(llm_response.generations[0][0].text)

            # Send data to OSC if enabled
            if self.osc_enabled:
                dimensions = result.dimensions.model_dump()
                self.osc_client.send_message("/emotion", [dimensions])

            return result

        except Exception as e:
            print(f"Error analyzing text: {str(e)}")
            raise
