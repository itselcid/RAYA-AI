"""LLM service — uses MiniMax (sponsor) as primary brain, Groq as fast fallback."""
import asyncio
import json
import httpx
from app.config import get_settings

settings = get_settings()

MINIMAX_BASE_URL = "https://api.minimaxi.chat/v1"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

MAX_RETRIES = 3


async def _retry_on_rate_limit(coro_func, *args, **kwargs):
    """Retry an async function with exponential backoff on 429 errors."""
    for attempt in range(MAX_RETRIES):
        try:
            return await coro_func(*args, **kwargs)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                print(f"Rate limited, retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(wait)
            else:
                raise


async def speech_to_text(audio_data: bytes, language: str = "ar") -> str:
    """Convert speech audio to text using MiniMax STT."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{MINIMAX_BASE_URL}/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.MINIMAX_API_KEY}"},
            files={"file": ("audio.wav", audio_data, "audio/wav")},
            data={"model": "speech-01", "language": language},
        )
        response.raise_for_status()
        result = response.json()
        return result.get("text", "")


async def chat_completion(
    messages: list[dict],
    system_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 300,
) -> str:
    """Generate a response — uses MiniMax (sponsor) as primary, Groq as fallback."""
    # Prefer MiniMax (hackathon sponsor tool)
    if settings.MINIMAX_API_KEY:
        try:
            return await _retry_on_rate_limit(
                _minimax_chat, messages, system_prompt, temperature, max_tokens
            )
        except Exception as e:
            print(f"MiniMax error, falling back to Groq: {e}")
            if settings.GROQ_API_KEY:
                return await _retry_on_rate_limit(
                    _groq_chat, messages, system_prompt, temperature, max_tokens
                )
            raise
    # Fallback to Groq
    if settings.GROQ_API_KEY:
        return await _retry_on_rate_limit(
            _groq_chat, messages, system_prompt, temperature, max_tokens
        )
    raise RuntimeError("No LLM API key configured (set MINIMAX_API_KEY or GROQ_API_KEY)")


async def _groq_chat(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Chat completion via Groq (OpenAI-compatible, very fast)."""
    # Filter out internal keys like _topic from message history
    clean_messages = [
        {k: v for k, v in m.items() if k in ("role", "content")}
        for m in messages
    ]
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{GROQ_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    *clean_messages,
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]


async def _minimax_chat(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Chat completion via MiniMax."""
    clean_messages = [
        {k: v for k, v in m.items() if k in ("role", "content")}
        for m in messages
    ]
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{MINIMAX_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "MiniMax-Text-01",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    *clean_messages,
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]


async def translate_darija_to_english(text: str) -> str:
    """Translate Darija text to English using MiniMax."""
    messages = [
        {"role": "user", "content": f"Translate this Darija (Moroccan Arabic) to English. Only output the translation:\n\n{text}"}
    ]
    return await chat_completion(
        messages=messages,
        system_prompt="You are a professional Darija-to-English translator. Translate accurately and naturally.",
        temperature=0.3,
        max_tokens=500,
    )


async def analyze_risk(transcript: str, patient_info: dict) -> dict:
    """Analyze call transcript — AI suggestion only, doctor reviews."""
    from app.prompts.medical_darija import RISK_ANALYSIS_PROMPT

    prompt = RISK_ANALYSIS_PROMPT.format(
        patient_name=patient_info.get("name", "Unknown"),
        condition=patient_info.get("condition", "Unknown"),
        weeks_enrolled=patient_info.get("weeks_enrolled", "Unknown"),
        doctor_questions=patient_info.get("doctor_questions", "No specific questions configured"),
        transcript=transcript,
    )

    result = await chat_completion(
        messages=[{"role": "user", "content": prompt}],
        system_prompt="You are a medical AI assistant that analyzes patient follow-up check-in calls for health risk. Respond ONLY with valid JSON.",
        temperature=0.2,
        max_tokens=1000,
    )

    try:
        return json.loads(result)
    except json.JSONDecodeError:
        # LLM often wraps JSON in markdown code blocks — try to extract it
        import re
        # Try to find JSON inside ```json ... ``` or ``` ... ``` or { ... }
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', result, re.DOTALL)
        if not json_match:
            json_match = re.search(r'(\{[^{}]*"risk_score"[^{}]*\})', result, re.DOTALL)
        if not json_match:
            # Try to find anything between first { and last }
            first_brace = result.find('{')
            last_brace = result.rfind('}')
            if first_brace != -1 and last_brace > first_brace:
                json_match_str = result[first_brace:last_brace + 1]
                try:
                    return json.loads(json_match_str)
                except json.JSONDecodeError:
                    pass

        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        print(f"Failed to parse risk analysis. Raw LLM output:\n{result[:500]}")
        return {
            "risk_score": 0.5,
            "risk_level": "medium",
            "detected_symptoms": [],
            "summary": "Unable to parse risk analysis",
            "recommendations": ["Manual review recommended"],
            "needs_immediate_attention": False,
        }
