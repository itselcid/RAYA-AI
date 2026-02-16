"""Voice pipeline: orchestrates the STT -> LLM -> TTS flow during a live call."""
import asyncio
import base64
import json
import uuid
from datetime import datetime, timezone

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call import Call, CallMessage
from app.services import minimax_service, elevenlabs_service
from app.prompts.medical_darija import SYSTEM_PROMPT


class VoicePipelineSession:
    """Manages a single voice call session."""

    def __init__(self, call_id: str, patient_name: str, db: AsyncSession):
        self.call_id = call_id
        self.patient_name = patient_name
        self.db = db
        self.conversation_history: list[dict] = []
        self.audio_buffer = bytearray()
        self.is_active = True
        self.stream_sid: str | None = None

    async def handle_media_stream(self, websocket: WebSocket):
        """Handle Twilio Media Stream WebSocket connection."""
        await websocket.accept()

        try:
            async for message in websocket.iter_text():
                data = json.loads(message)
                event = data.get("event")

                if event == "connected":
                    pass  # Connection established
                elif event == "start":
                    self.stream_sid = data.get("start", {}).get("streamSid")
                elif event == "media":
                    # Accumulate audio data
                    payload = data.get("media", {}).get("payload", "")
                    audio_chunk = base64.b64decode(payload)
                    self.audio_buffer.extend(audio_chunk)

                    # Process when we have enough audio (~2 seconds of mulaw 8kHz)
                    if len(self.audio_buffer) >= 16000:
                        await self._process_audio_chunk(websocket)
                elif event == "stop":
                    self.is_active = False
                    break
        except Exception as e:
            print(f"Voice pipeline error: {e}")
        finally:
            self.is_active = False

    async def _process_audio_chunk(self, websocket: WebSocket):
        """Process accumulated audio: STT -> LLM -> TTS -> Stream back."""
        audio_data = bytes(self.audio_buffer)
        self.audio_buffer.clear()

        try:
            # 1. Speech to Text
            patient_text = await minimax_service.speech_to_text(audio_data)
            if not patient_text.strip():
                return

            # 2. Save patient message
            translation = await minimax_service.translate_darija_to_english(patient_text)
            patient_msg = CallMessage(
                call_id=uuid.UUID(self.call_id),
                role="patient",
                content_darija=patient_text,
                content_english=translation,
            )
            self.db.add(patient_msg)
            await self.db.flush()

            # 3. Add to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": patient_text,
            })

            # 4. Generate AI response
            ai_response = await minimax_service.chat_completion(
                messages=self.conversation_history,
                system_prompt=SYSTEM_PROMPT.replace("[name]", self.patient_name),
            )

            # 5. Save AI message
            ai_translation = await minimax_service.translate_darija_to_english(ai_response)
            ai_msg = CallMessage(
                call_id=uuid.UUID(self.call_id),
                role="ai",
                content_darija=ai_response,
                content_english=ai_translation,
            )
            self.db.add(ai_msg)
            await self.db.flush()

            # 6. Add to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": ai_response,
            })

            # 7. Text to Speech
            audio_response = await elevenlabs_service.text_to_speech(ai_response)

            # 8. Send audio back through Twilio
            encoded_audio = base64.b64encode(audio_response).decode("utf-8")
            media_message = {
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {"payload": encoded_audio},
            }
            await websocket.send_text(json.dumps(media_message))

        except Exception as e:
            print(f"Error processing audio chunk: {e}")

    def get_full_transcript(self) -> str:
        """Get the full conversation transcript."""
        transcript_parts = []
        for msg in self.conversation_history:
            role = "Raya AI" if msg["role"] == "assistant" else "Patient"
            transcript_parts.append(f"{role}: {msg['content']}")
        return "\n".join(transcript_parts)
