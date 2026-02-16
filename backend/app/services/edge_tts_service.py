"""Edge TTS service — free Moroccan Arabic (Darija) text-to-speech.

Uses Microsoft Edge's neural voices via the edge-tts library.
No API key required. Supports ar-MA (Moroccan Arabic) natively.
"""
import io
import edge_tts

# Moroccan Arabic voices
VOICE_FEMALE = "ar-MA-MounaNeural"  # Female — warm, natural
VOICE_MALE = "ar-MA-JamalNeural"    # Male — clear, steady

DEFAULT_VOICE = VOICE_FEMALE  # RAYA is a female AI assistant


async def text_to_speech(
    text: str,
    voice: str = DEFAULT_VOICE,
    rate: str = "-5%",   # Slightly slower for clarity
) -> bytes:
    """Convert Arabic/Darija text to speech audio (MP3 bytes).

    Args:
        text: The Arabic text to speak.
        voice: Edge TTS voice name (default: ar-MA-MounaNeural).
        rate: Speech rate adjustment (e.g. "-10%", "+5%").

    Returns:
        Raw MP3 audio bytes.
    """
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    buffer = io.BytesIO()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])

    return buffer.getvalue()
