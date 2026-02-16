"""Twilio service for making and managing phone calls."""
from twilio.rest import Client
from app.config import get_settings

settings = get_settings()


def get_twilio_client() -> Client:
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


async def initiate_call(patient_phone: str, call_id: str) -> str:
    """Initiate an outbound call to a patient. Returns Twilio Call SID."""
    client = get_twilio_client()

    call = client.calls.create(
        to=patient_phone,
        from_=settings.TWILIO_PHONE_NUMBER,
        url=f"{settings.BASE_URL}/api/webhooks/twilio/voice",
        status_callback=f"{settings.BASE_URL}/api/webhooks/twilio/status",
        status_callback_event=["initiated", "ringing", "answered", "completed"],
        status_callback_method="POST",
        machine_detection="Enable",
        record=True,
    )
    return call.sid


async def end_call(call_sid: str):
    """End an active call."""
    client = get_twilio_client()
    client.calls(call_sid).update(status="completed")
