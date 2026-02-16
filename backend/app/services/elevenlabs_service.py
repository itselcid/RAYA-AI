"""ElevenLabs TTS service for generating Arabic/Darija speech."""
import httpx
from app.config import get_settings

settings = get_settings()

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


async def text_to_speech(
    text: str,
    voice_id: str | None = None,
    model_id: str = "eleven_multilingual_v2",
) -> bytes:
    """Convert text to speech audio using ElevenLabs."""
    vid = voice_id or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"  # Default: Rachel

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{ELEVENLABS_BASE_URL}/text-to-speech/{vid}",
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.3,
                    "use_speaker_boost": True,
                },
            },
        )
        response.raise_for_status()
        return response.content


async def text_to_speech_stream(
    text: str,
    voice_id: str | None = None,
    model_id: str = "eleven_multilingual_v2",
):
    """Stream TTS audio chunks for lower latency."""
    vid = voice_id or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            "POST",
            f"{ELEVENLABS_BASE_URL}/text-to-speech/{vid}/stream",
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                },
            },
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(1024):
                yield chunk
