from pydantic import BaseModel, Field
from typing import Dict, Optional


class EmotionDimensions(BaseModel):
    """Plutchik emotion wheel's eight basic emotion dimensions"""

    joy: float = Field(ge=0.0, le=1.0, description="Joy emotion intensity, range 0-1")
    trust: float = Field(
        ge=0.0, le=1.0, description="Trust emotion intensity, range 0-1"
    )
    fear: float = Field(ge=0.0, le=1.0, description="Fear emotion intensity, range 0-1")
    surprise: float = Field(
        ge=0.0, le=1.0, description="Surprise emotion intensity, range 0-1"
    )
    sadness: float = Field(
        ge=0.0, le=1.0, description="Sadness emotion intensity, range 0-1"
    )
    disgust: float = Field(
        ge=0.0, le=1.0, description="Disgust emotion intensity, range 0-1"
    )
    anger: float = Field(
        ge=0.0, le=1.0, description="Anger emotion intensity, range 0-1"
    )
    anticipation: float = Field(
        ge=0.0, le=1.0, description="Anticipation emotion intensity, range 0-1"
    )


class EmotionAnalysis(BaseModel):
    """Structured output model for multi-dimensional emotion analysis results"""

    dimensions: EmotionDimensions = Field(
        description="Eight emotion dimensions of Plutchik's emotion wheel"
    )
    dominant_emotion: str = Field(
        description="The primary emotion, or 'neutral' if all emotions are below threshold"
    )
    brief_explanation: str = Field(
        description="Brief explanation of the emotion analysis, no more than 100 characters"
    )


class TextRequest(BaseModel):
    """Request model for text analysis"""

    text: str = Field(..., description="Text to analyze for emotional content")


class OSCSettings(BaseModel):
    """Settings for OSC (Open Sound Control) output"""

    ip: str = Field(default="127.0.0.1", description="OSC server IP address")
    port: int = Field(default=7000, description="OSC server port")
    enabled: bool = Field(default=True, description="Whether OSC output is enabled")
