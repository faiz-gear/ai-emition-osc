import os
import json
import time
import queue
import numpy as np
import asyncio
from typing import Optional, Callable, List
import sounddevice as sd
from vosk import Model, KaldiRecognizer


class SpeechService:
    """Service for handling speech recognition"""

    def __init__(
        self,
        model_path: str = None,
        sample_rate: int = 16000,
        on_text_callback: Optional[Callable[[str], None]] = None,
    ):
        """
        Initialize speech recognizer

        Args:
            model_path: Vosk model path
            sample_rate: Sample rate
            on_text_callback: Callback function when text is recognized
        """
        # Get model path from environment variable or use default
        if not model_path:
            model_path = os.environ.get("AI_EMOTION_VOSK_MODEL", "vosk-model-small-cn")

        self.sample_rate = sample_rate
        self.model = Model(model_path)
        self.recognizer = KaldiRecognizer(self.model, sample_rate)
        self.recognizer.SetWords(True)  # Enable word-level timestamps
        self.audio_queue = queue.Queue()
        self.on_text_callback = on_text_callback

        # Get audio configuration parameters from environment variables
        self.blocksize = int(os.environ.get("AI_EMOTION_BLOCKSIZE", "2000"))

        # Audio input stream configuration
        self.stream = sd.InputStream(
            channels=1,
            dtype=np.int16,
            samplerate=sample_rate,
            callback=self._audio_callback,
            blocksize=self.blocksize,  # Buffer size, affects latency
        )

        self._is_running = False
        self._current_text = ""
        self._last_speech_time = time.time()

        # Read threshold configuration from environment variables
        self._silence_threshold = int(
            os.environ.get("AI_EMOTION_SILENCE_THRESHOLD", "500")
        )
        self._min_speech_duration = float(
            os.environ.get("AI_EMOTION_MIN_SPEECH_DURATION", "0.3")
        )
        self._max_silence_duration = float(
            os.environ.get("AI_EMOTION_MAX_SILENCE_DURATION", "0.5")
        )
        self._is_speaking = False

    def _audio_callback(self, indata, frames, time_info, status):
        """Audio input callback function"""
        if status:
            print(f"Audio input status: {status}")
        self.audio_queue.put(bytes(indata))

    def _is_silence(self, audio_data: bytes) -> bool:
        """Detect whether it's silence"""
        return (
            np.max(np.abs(np.frombuffer(audio_data, dtype=np.int16)))
            < self._silence_threshold
        )

    async def process_audio(self):
        """Process audio data"""
        while self._is_running:
            try:
                # Get audio data in non-blocking mode
                audio_data = self.audio_queue.get_nowait()
                current_time = time.time()

                # Detect if there is speech
                is_current_silence = self._is_silence(audio_data)

                if not is_current_silence:
                    self._last_speech_time = current_time
                    if not self._is_speaking:
                        self._is_speaking = True
                        self._current_text = ""

                # Process speech recognition
                if self.recognizer.AcceptWaveform(audio_data):
                    result = json.loads(self.recognizer.Result())
                    text = result.get("text", "").strip()
                    if text:
                        self._current_text = text
                        # Output partial results in real-time
                        if (
                            len(self._current_text) > 5
                        ):  # Accumulate a certain length before output
                            if self.on_text_callback:
                                await self.on_text_callback(self._current_text)
                            self._current_text = ""

                # Detect end of speech segment
                if self._is_speaking and is_current_silence:
                    silence_duration = current_time - self._last_speech_time
                    if silence_duration > self._max_silence_duration:
                        self._is_speaking = False
                        # Process remaining text
                        if self._current_text and self.on_text_callback:
                            await self.on_text_callback(self._current_text)
                            self._current_text = ""

            except queue.Empty:
                await asyncio.sleep(0.01)  # Reduce sleep time
            except Exception as e:
                print(f"Error processing audio: {str(e)}")
                await asyncio.sleep(0.01)

    async def start(self):
        """Start speech recognition"""
        print("Starting speech recognition...")
        self._is_running = True
        self.stream.start()
        await self.process_audio()

    async def stop(self):
        """Stop speech recognition"""
        self._is_running = False
        self.stream.stop()
        self.stream.close()
        print("Speech recognition stopped")
