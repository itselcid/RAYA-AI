"""Groq TTS service — fast Arabic text-to-speech using Orpheus model."""
import httpx
from app.config import get_settings

settings = get_settings()

GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech"

# Arabic (Saudi) model — closest available Arabic dialect
ARABIC_MODEL = "canopylabs/orpheus-arabic-saudi"
ENGLISH_MODEL = "canopylabs/orpheus-v1-english"


async def text_to_speech(
    text: str,
    model: str = ARABIC_MODEL,
    voice: str = "tala",
    response_format: str = "mp3",
) -> bytes:
    """Convert text to speech using Groq's Orpheus TTS.
    
    Returns audio bytes (mp3 by default).
    """
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GROQ_TTS_URL,
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "input": text,
                "voice": voice,
                "response_format": response_format,
            },
        )
        response.raise_for_status()
        return response.content


async def text_to_speech_arabic(text: str) -> bytes:
    """Shortcut for Arabic TTS."""
    return await text_to_speech(text, model=ARABIC_MODEL)


async def text_to_speech_english(text: str) -> bytes:
    """Shortcut for English TTS."""
    return await text_to_speech(text, model=ENGLISH_MODEL, voice="troy")
