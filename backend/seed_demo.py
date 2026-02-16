"""Seed realistic demo data for hackathon presentation — AI patient follow-up."""
import asyncio
import uuid
from datetime import date, datetime, timezone, timedelta

from sqlalchemy import select
from app.database import engine, Base, async_session
from app.models.user import User
from app.models.patient import Patient, PatientQuestion
from app.models.call import Call, CallMessage, CallSchedule
from app.models.alert import Alert
from app.api.auth import hash_password


# Default questions per condition type — doctor configures these
DEFAULT_QUESTIONS = {
    "diabetes": [
        {"text": "واش قيستي السكر ديالك هاد الأسبوع؟ شحال طلع ليك؟", "english": "Did you check your blood sugar this week? What was the reading?", "category": "vitals", "order": 1},
        {"text": "واش كتاخد الدوا ديالك بانتظام كيف ما قال ليك الدكتور؟", "english": "Are you taking your medication regularly as the doctor prescribed?", "category": "medication", "order": 2},
        {"text": "واش نسيتي شي جرعة هاد الأسبوع؟", "english": "Did you miss any doses this week?", "category": "medication", "order": 3},
        {"text": "واش كتحس بشي تنميل فالرجلين ولا اليدين؟", "english": "Do you feel any numbness in your feet or hands?", "category": "symptoms", "order": 4},
        {"text": "كيفاش الماكلة ديالك؟ واش كتاكل مزيان؟", "english": "How is your diet? Are you eating well?", "category": "diet", "order": 5},
        {"text": "واش كتحس بشي غبشة فالعينين؟", "english": "Do you feel any blurriness in your eyes?", "category": "symptoms", "order": 6},
    ],
    "hypertension": [
        {"text": "واش قيستي الضغط ديالك؟ شحال كان؟", "english": "Did you measure your blood pressure? What was the reading?", "category": "vitals", "order": 1},
        {"text": "واش كتاخد الدوا ديال الضغط بانتظام؟", "english": "Are you taking your blood pressure medication regularly?", "category": "medication", "order": 2},
        {"text": "واش كتحس بشي صداع ولا دوخة؟", "english": "Do you feel any headaches or dizziness?", "category": "symptoms", "order": 3},
        {"text": "واش كتنقص الملح فالماكلة ديالك؟", "english": "Are you reducing salt in your food?", "category": "diet", "order": 4},
        {"text": "واش كتمشي ولا كدير شي رياضة؟", "english": "Are you walking or doing any exercise?", "category": "diet", "order": 5},
        {"text": "كيفاش النعاس ديالك بالليل؟", "english": "How is your sleep at night?", "category": "mental", "order": 6},
    ],
    "heart": [
        {"text": "كيف كتحس اليوم؟ واش كتحس بشي ضيق فالصدر؟", "english": "How do you feel today? Do you feel any tightness in your chest?", "category": "symptoms", "order": 1},
        {"text": "واش كتاخد الأدوية ديالك كاملين بانتظام؟", "english": "Are you taking all your medications regularly?", "category": "medication", "order": 2},
        {"text": "واش كتلقى صعوبة فالتنفس خصوصا ملي كتمشي؟", "english": "Do you have difficulty breathing especially when walking?", "category": "symptoms", "order": 3},
        {"text": "واش كتحس بخفقان فالقلب ديالك؟", "english": "Do you feel any heart palpitations?", "category": "symptoms", "order": 4},
        {"text": "واش رجليك كينتافخو؟", "english": "Are your legs swelling?", "category": "symptoms", "order": 5},
    ],
    "respiratory": [
        {"text": "كيفاش التنفس ديالك هاد الأسبوع؟", "english": "How has your breathing been this week?", "category": "symptoms", "order": 1},
        {"text": "واش كتاخد الدوا ديالك بانتظام؟", "english": "Are you taking your medication regularly?", "category": "medication", "order": 2},
        {"text": "واش استعملتي البخاخ ديال الطوارئ هاد الأسبوع؟", "english": "Did you use your emergency inhaler this week?", "category": "medication", "order": 3},
        {"text": "واش كتسمع شي صفير ملي كتنفس؟", "english": "Do you hear any wheezing when breathing?", "category": "symptoms", "order": 4},
        {"text": "واش كتنعس مزيان بالليل بلا ما تنهج؟", "english": "Do you sleep well at night without shortness of breath?", "category": "mental", "order": 5},
    ],
    "alzheimer": [
        {"text": "كيف داير/ة اليوم؟ واش عرفتي شكون أنا؟", "english": "How are you today? Do you remember who I am?", "category": "general", "order": 1},
        {"text": "واش خديتي الدوا ديالك اليوم؟", "english": "Did you take your medication today?", "category": "medication", "order": 2},
        {"text": "واش كليتي وشربتي مزيان اليوم؟", "english": "Did you eat and drink well today?", "category": "diet", "order": 3},
        {"text": "واش نعستي مزيان البارح بالليل؟", "english": "Did you sleep well last night?", "category": "mental", "order": 4},
        {"text": "واش خرجتي من الدار ولا تمشيتي شوية؟", "english": "Did you go outside or take a walk?", "category": "diet", "order": 5},
        {"text": "واش كتحس بشي قلق ولا خوف ولا حزن؟", "english": "Do you feel any anxiety, fear, or sadness?", "category": "mental", "order": 6},
        {"text": "واش كاين شي حد معاك فالدار اليوم؟", "english": "Is someone with you at home today?", "category": "general", "order": 7},
    ],
    "chemotherapy": [
        {"text": "كيف كتحس من بعد الحصة ديال العلاج؟", "english": "How do you feel after your treatment session?", "category": "symptoms", "order": 1},
        {"text": "واش عندك شي غثيان ولا تقيو؟", "english": "Do you have any nausea or vomiting?", "category": "symptoms", "order": 2},
        {"text": "واش كتاخد الأدوية ديال الغثيان بانتظام؟", "english": "Are you taking your anti-nausea medication regularly?", "category": "medication", "order": 3},
        {"text": "واش كتقدر تاكل وتشرب مزيان؟", "english": "Are you able to eat and drink well?", "category": "diet", "order": 4},
        {"text": "واش عندك شي سخانة ولا برد؟", "english": "Do you have any fever or chills?", "category": "symptoms", "order": 5},
        {"text": "واش كتحس بتعب كبير ولا ضعف؟", "english": "Do you feel extreme fatigue or weakness?", "category": "symptoms", "order": 6},
        {"text": "واش شفتي شي تقرحات فالفم ديالك؟", "english": "Have you noticed any mouth sores?", "category": "symptoms", "order": 7},
        {"text": "واش كتنعس مزيان بالليل؟", "english": "Are you sleeping well at night?", "category": "mental", "order": 8},
    ],
    "post_surgery": [
        {"text": "كيف كتحس اليوم من بعد العملية؟", "english": "How do you feel today after the surgery?", "category": "general", "order": 1},
        {"text": "واش كتاخد الدوا ديال الوجع بانتظام؟", "english": "Are you taking your pain medication regularly?", "category": "medication", "order": 2},
        {"text": "واش الجرح ديالك نظيف وماشي حامي ولا حمر؟", "english": "Is your wound clean and not hot or red?", "category": "symptoms", "order": 3},
        {"text": "واش كتحس بشي سخانة ولا حمى؟", "english": "Do you feel any fever?", "category": "symptoms", "order": 4},
        {"text": "واش كتقدر تمشي وتحرك براسك؟", "english": "Are you able to walk and move on your own?", "category": "symptoms", "order": 5},
        {"text": "واش كتاكل وكتشرب مزيان؟", "english": "Are you eating and drinking well?", "category": "diet", "order": 6},
    ],
}


def get_default_questions_for_condition(condition: str) -> list[dict]:
    """Return default questions based on condition keywords."""
    cond_lower = condition.lower()
    questions = []
    if "diabet" in cond_lower or "سكر" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["diabetes"])
    if "hypertension" in cond_lower or "ضغط" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["hypertension"])
    if "heart" in cond_lower or "قلب" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["heart"])
    if "asthma" in cond_lower or "copd" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["respiratory"])
    if "alzheimer" in cond_lower or "dementia" in cond_lower or "زهايمر" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["alzheimer"])
    if "chemo" in cond_lower or "cancer" in cond_lower or "oncol" in cond_lower or "سرطان" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["chemotherapy"])
    if "surgery" in cond_lower or "operation" in cond_lower or "عملية" in cond_lower or "post-op" in cond_lower:
        questions.extend(DEFAULT_QUESTIONS["post_surgery"])
    if not questions:
        # Generic fallback
        questions = [
            {"text": "كيف كتحس اليوم بشكل عام؟", "english": "How do you feel today overall?", "category": "general", "order": 1},
            {"text": "واش كتاخد الدوا ديالك بانتظام؟", "english": "Are you taking your medication regularly?", "category": "medication", "order": 2},
            {"text": "واش عندك شي أعراض جديدة؟", "english": "Do you have any new symptoms?", "category": "symptoms", "order": 3},
        ]
    # Re-number orders
    for i, q in enumerate(questions):
        q["order"] = i + 1
    return questions


DEMO_PATIENTS = [
    {
        "name": "Fatima Zahra El Amrani",
        "phone": "+212661234567",
        "age": 58,
        "gender": "female",
        "condition": "Type 2 Diabetes",
        "enrollment_date": date.today() - timedelta(days=42),
        "city": "Casablanca",
        "status": "at_risk",
        "call_frequency": "every_3_days",
        "call_time": "09:00",
    },
    {
        "name": "Ahmed Benali",
        "phone": "+212662345678",
        "age": 65,
        "gender": "male",
        "condition": "Hypertension Stage 2",
        "enrollment_date": date.today() - timedelta(days=28),
        "city": "Rabat",
        "status": "active",
        "call_frequency": "weekly",
        "call_time": "10:30",
    },
    {
        "name": "Khadija Mourad",
        "phone": "+212663456789",
        "age": 45,
        "gender": "female",
        "condition": "Type 2 Diabetes + Hypertension",
        "enrollment_date": date.today() - timedelta(days=56),
        "city": "Marrakech",
        "status": "active",
        "call_frequency": "weekly",
        "call_time": "11:00",
    },
    {
        "name": "Youssef Idrissi",
        "phone": "+212664567890",
        "age": 72,
        "gender": "male",
        "condition": "Heart Failure (NYHA II)",
        "enrollment_date": date.today() - timedelta(days=90),
        "city": "Fes",
        "status": "active",
        "call_frequency": "every_3_days",
        "call_time": "08:00",
    },
    {
        "name": "Amina Tazi",
        "phone": "+212665678901",
        "age": 38,
        "gender": "female",
        "condition": "Asthma (Moderate Persistent)",
        "enrollment_date": date.today() - timedelta(days=21),
        "city": "Tangier",
        "status": "active",
        "call_frequency": "weekly",
        "call_time": "14:00",
    },
    {
        "name": "Omar Benjelloun",
        "phone": "+212666789012",
        "age": 60,
        "gender": "male",
        "condition": "Type 2 Diabetes",
        "enrollment_date": date.today() - timedelta(days=35),
        "city": "Agadir",
        "status": "at_risk",
        "call_frequency": "daily",
        "call_time": "09:30",
    },
    {
        "name": "Salma Alaoui",
        "phone": "+212667890123",
        "age": 50,
        "gender": "female",
        "condition": "COPD (Stage II)",
        "enrollment_date": date.today() - timedelta(days=63),
        "city": "Meknes",
        "status": "active",
        "call_frequency": "biweekly",
        "call_time": "15:00",
    },
    {
        "name": "Hassan Chaoui",
        "phone": "+212668901234",
        "age": 68,
        "gender": "male",
        "condition": "Hypertension + Type 2 Diabetes",
        "enrollment_date": date.today() - timedelta(days=120),
        "city": "Oujda",
        "status": "active",
        "call_frequency": "weekly",
        "call_time": "10:00",
    },
    {
        "name": "Malika Benmoussa",
        "phone": "+212669012345",
        "age": 76,
        "gender": "female",
        "condition": "Alzheimer's Disease (Early Stage) + Type 2 Diabetes",
        "enrollment_date": date.today() - timedelta(days=30),
        "city": "Kenitra",
        "status": "at_risk",
        "call_frequency": "daily",
        "call_time": "08:30",
    },
    {
        "name": "Rachid El Fassi",
        "phone": "+212660123456",
        "age": 54,
        "gender": "male",
        "condition": "Chemotherapy — Colon Cancer (Stage II)",
        "enrollment_date": date.today() - timedelta(days=14),
        "city": "Casablanca",
        "status": "at_risk",
        "call_frequency": "every_3_days",
        "call_time": "16:00",
    },
]

# Pre-built call transcripts with Darija + English — patient check-ins
DEMO_CALLS = [
    {
        "patient_idx": 0,  # Fatima - high risk diabetic
        "duration": 240,
        "risk_score": 0.78,
        "summary": "Patient reports blood sugar reading of 320 mg/dL, missed insulin dose twice this week, and numbness in feet. Medication adherence is poor. Requires urgent doctor review.",
        "detected_symptoms": {
            "symptoms": [
                {"symptom": "High blood sugar (320 mg/dL)", "severity": "severe", "details": "Well above target range"},
                {"symptom": "Numbness in feet", "severity": "moderate", "details": "Possible diabetic neuropathy"},
                {"symptom": "Missed insulin doses", "severity": "moderate", "details": "Skipped 2 doses this week"},
            ],
            "risk_level": "high",
            "recommendations": ["Urgent blood sugar management review", "Neuropathy screening", "Medication adherence counseling"],
        },
        "messages": [
            ("ai", "السلام عليكم ختي فاطمة الزهرة، كيف دايري اليوم؟ أنا رعاية، كنتصل بيك من طرف الدكتور باش نشوفو كيفاش صحتك هاد الأسبوع.", "Hello sister Fatima Zahra, how are you today? I'm Raya, calling on behalf of the doctor to check on your health this week."),
            ("patient", "وعليكم السلام، الحمد لله بصح السكر طالع لي بزاف هاد الأيام.", "Hello, thank God but my blood sugar has been very high these days."),
            ("ai", "واش قيستي السكر ديالك؟ شحال طلع ليك؟", "Did you check your blood sugar? What was the reading?"),
            ("patient", "ايه قيستو لبارح، طلع لي 320. ونسيت ناخد الأنسولين جوج مرات هاد الأسبوع.", "Yes I checked it yesterday, it was 320. And I forgot to take insulin twice this week."),
            ("ai", "320 عالي بزاف ختي. واش كتحسي بشي دوخة ولا تنميل فالرجلين؟", "320 is very high sister. Do you feel any dizziness or numbness in your feet?"),
            ("patient", "ايه والله، كنحس بتنميل فالرجلين ديالي خصوصا بالليل.", "Yes indeed, I feel numbness in my feet especially at night."),
            ("ai", "هاد التنميل مهم بزاف ختي فاطمة. غادي نبلغ الدكتور على السكر العالي والتنميل. تهلاي فراسك وما تنساي الأنسولين.", "This numbness is very important sister Fatima. I will inform the doctor about the high sugar and numbness. Take care and don't forget your insulin."),
        ],
    },
    {
        "patient_idx": 1,  # Ahmed - well-controlled hypertension
        "duration": 150,
        "risk_score": 0.12,
        "summary": "Patient well-controlled. Blood pressure 130/85, taking all medications. No headaches or dizziness. Good diet and daily walks. Excellent adherence.",
        "detected_symptoms": {
            "symptoms": [
                {"symptom": "Slightly elevated BP", "severity": "mild", "details": "130/85 - within acceptable range"},
            ],
            "risk_level": "low",
            "recommendations": ["Continue current treatment", "Next check-in in 1 week"],
        },
        "messages": [
            ("ai", "السلام عليكم خويا أحمد، كيف داير اليوم؟ أنا رعاية كنتصل بيك باش نشوفو الضغط ديالك كيفاش هاد الأسبوع.", "Hello brother Ahmed, how are you today? I'm Raya calling to check on your blood pressure this week."),
            ("patient", "الحمد لله مزيان بزاف. قيست الضغط لبارح، كان 130 على 85.", "Thank God I'm very good. I measured my blood pressure yesterday, it was 130 over 85."),
            ("ai", "الحمد لله، الضغط مزيان. واش كتاخد الدوا ديالك بانتظام وكتاكل مزيان؟", "Good to hear, blood pressure is fine. Are you taking your medication regularly and eating well?"),
            ("patient", "ايه كناخد الدوا ديالي كل يوم والحمد لله كنتمشى شوية كل صباح.", "Yes I take my medication every day and thank God I walk a bit every morning."),
            ("ai", "تبارك الله عليك خويا أحمد، كمل هاكا. الدكتور غادي يكون فرحان بالنتائج هاد. الله يعطيك الصحة.", "Well done brother Ahmed, keep it up. The doctor will be happy with these results. May God give you health."),
        ],
    },
    {
        "patient_idx": 5,  # Omar - medium risk diabetic
        "duration": 195,
        "risk_score": 0.52,
        "summary": "Patient reports blood sugar fluctuations (180-250 range), partial medication adherence, and poor diet. Skipping evening medication. Vision slightly blurry in the morning.",
        "detected_symptoms": {
            "symptoms": [
                {"symptom": "Blood sugar fluctuation (180-250)", "severity": "moderate", "details": "Above target but not critical"},
                {"symptom": "Blurry morning vision", "severity": "moderate", "details": "Possible diabetic retinopathy sign"},
                {"symptom": "Partial medication adherence", "severity": "moderate", "details": "Skipping evening dose"},
            ],
            "risk_level": "medium",
            "recommendations": ["Ensure full medication compliance", "Eye examination referral", "Dietary counseling"],
        },
        "messages": [
            ("ai", "السلام عليكم خويا عمر، كيف داير اليوم؟ كيفاش السكر ديالك هاد الأسبوع؟", "Hello brother Omar, how are you today? How has your blood sugar been this week?"),
            ("patient", "الحمد لله بصح السكر كيطلع ويهبط. مرات 180 مرات 250.", "I'm okay but the sugar goes up and down. Sometimes 180, sometimes 250."),
            ("ai", "واش كتاخد الدوا ديالك كامل؟ وكيفاش الماكلة ديالك هاد الأيام؟", "Are you taking all your medication? And how has your diet been lately?"),
            ("patient", "الدوا كنتاخدو بصح مرات كننسا الليل. والماكلة... كناكل بزاف الخبز والعسل.", "I take the medication but sometimes I forget the evening one. And food... I eat a lot of bread and honey."),
            ("ai", "خويا عمر، الخبز والعسل كيزيدو السكر بزاف. واش كتحس بشي حاجة فالعينين ديالك؟", "Brother Omar, bread and honey raise sugar a lot. Do you feel anything with your eyes?"),
            ("patient", "ايه، مرات كنشوف غبشة فالصباح بصح كتمشي.", "Yes, sometimes I see blurriness in the morning but it goes away."),
            ("ai", "هاد الغبشة مهمة خويا. غادي نبلغ الدكتور. حاول تنقص الخبز والعسل وما تنساش الدوا ديال الليل.", "That blurriness is important brother. I'll inform the doctor. Try to reduce bread and honey and don't forget your evening medication."),
        ],
    },
    # Malika — Alzheimer's + Diabetes — son (Youssef) answers on her behalf
    # This is the call that shows why RAYA matters
    {
        "patient_idx": 8,  # Malika Benmoussa
        "duration": 380,
        "risk_score": 0.91,
        "summary": "CRITICAL: Call answered by patient's son Youssef (caregiver). Reports mother's Alzheimer's worsening — she wandered out of the house alone 3 days ago, found by neighbors. Mixing up diabetes and blood pressure medications regularly. Refusing to eat, blood sugar dropped to 55 mg/dL last week (severe hypoglycemia). Son is emotionally overwhelmed, works full-time and cannot provide 24/7 care. No professional caregiver. Urgent intervention needed — patient safety at serious risk.",
        "detected_symptoms": {
            "symptoms": [
                {"symptom": "Wandering episode", "severity": "severe", "details": "Patient left the house alone 3 days ago disoriented. Found by neighbors in the street. Alzheimer's progression sign."},
                {"symptom": "Medication confusion / mix-up", "severity": "severe", "details": "Son reports mother takes wrong pills regularly — confuses diabetes medication with blood pressure pills. Found her taking double doses."},
                {"symptom": "Severe hypoglycemia (55 mg/dL)", "severity": "severe", "details": "Blood sugar crashed to 55 mg/dL last week. Combined with medication mix-ups, extremely dangerous."},
                {"symptom": "Refusing food / weight loss", "severity": "severe", "details": "Patient barely eating — son says she forgets she hasn't eaten, or refuses food. Noticeable weight loss."},
                {"symptom": "Caregiver burnout", "severity": "moderate", "details": "Son broke down during call. Works full-time, cannot provide 24/7 care. No other family nearby. Feeling guilty and helpless."},
                {"symptom": "Night confusion / sundowning", "severity": "moderate", "details": "Patient wakes at night confused, sometimes screams. Doesn't recognize her own home."},
            ],
            "risk_level": "critical",
            "question_answers": [
                {"question": "How is the patient today?", "answer_summary": "Son (Youssef) answered. Says his mother's condition is getting worse. She didn't recognize him this morning for 10 minutes.", "concern_level": "urgent"},
                {"question": "Did she take her medication today?", "answer_summary": "Son gave her the medication himself today, but admits when he's at work she mixes them up or takes double doses. Found her taking BP pills instead of diabetes pills twice last week.", "concern_level": "urgent"},
                {"question": "Did she eat and drink well?", "answer_summary": "She barely ate yesterday. Son says she forgets she hasn't eaten and refuses food when offered. She's lost weight visibly.", "concern_level": "urgent"},
                {"question": "Did she sleep well?", "answer_summary": "She woke up 4 times last night, confused and agitated. Once she screamed because she didn't know where she was. Son barely slept either.", "concern_level": "concerning"},
                {"question": "What was her last blood sugar reading?", "answer_summary": "Son checked 2 days ago: 210 mg/dL. But last week it crashed to 55 — she was shaking and sweating. He gave her juice. Very scared.", "concern_level": "urgent"},
                {"question": "Any wandering or confusion incidents?", "answer_summary": "3 days ago she left the house alone while son was at work. Neighbors found her walking in the street, disoriented, in her nightgown. She couldn't say where she lived.", "concern_level": "urgent"},
                {"question": "Is someone with her during the day?", "answer_summary": "Son works 8 hours. She's alone most of the day. No professional caregiver. He can't afford one. Other family lives far away. He broke down crying.", "concern_level": "urgent"},
            ],
            "recommendations": [
                "URGENT: Arrange professional caregiver or home aide — patient cannot be left alone",
                "Medication management: prescribe pre-sorted pillbox with AM/PM labels, involve pharmacy",
                "Blood sugar monitoring: provide simplified glucose device or continuous monitor (CGM)",
                "Nutrition plan: home-delivered meals or meal prep service to prevent malnutrition",
                "Alzheimer's reassessment: wandering and night confusion suggest disease progression — neurology referral",
                "Caregiver support: refer son to caregiver support group, assess burnout, discuss respite care options",
                "Safety: door alarm or GPS tracker to prevent future wandering episodes",
            ],
            "needs_immediate_attention": True,
            "status": "pending_review",
        },
        "messages": [
            ("ai",
             "السلام عليكم لالة مليكة، كيف دايرة اليوم؟ أنا رعاية، كنتصل بيك من طرف الدكتور ديالك.",
             "Hello Lalla Malika, how are you today? I'm Raya, calling on behalf of your doctor."),
            ("patient",
             "آلو، لا هادي ماشي مليكة، أنا يوسف ولدها. الوالدة ما قادراش تهضر فالتيليفون.",
             "Hello, no this is not Malika, I'm Youssef her son. My mother can't talk on the phone."),
            ("ai",
             "السلام عليكم خويا يوسف. ما عليه، نقدر نهضر معاك على صحة الوالدة. كيف دايرة لالة مليكة اليوم؟",
             "Hello brother Youssef. No problem, I can talk with you about your mother's health. How is Lalla Malika today?"),
            ("patient",
             "والله أختي... الوضع صعيب بزاف. اليوم فالصباح ما عرفاتنيش. بقات تشوف فيا شي 10 دقائق وكتقولي شكون نتا... أنا ولدها أختي.",
             "Honestly sister... The situation is very hard. This morning she didn't recognize me. She stared at me for 10 minutes saying 'who are you'... I'm her son, sister."),
            ("ai",
             "الله يعطيك الصبر خويا يوسف. واش عطيتيها الدوا ديالها اليوم؟",
             "God give you patience brother Youssef. Did you give her her medication today?"),
            ("patient",
             "اليوم ايه، أنا لي عطيتها ليها. بصح المشكل ملي كنكون فالخدمة... لقيتها مرتين هاد الأسبوع خدات ديال الضغط بدل ديال السكر. ومرة خدات جوج حبات بدل وحدة. كلشي كيتشابه عليها أختي.",
             "Today yes, I gave them to her myself. But the problem is when I'm at work... I found her twice this week taking blood pressure pills instead of diabetes pills. And once she took two pills instead of one. Everything looks the same to her, sister."),
            ("ai",
             "هاد الشي خطير بزاف خويا. واش الوالدة كتاكل مزيان؟ كيفاش الماكلة ديالها؟",
             "This is very dangerous brother. Is your mother eating well? How is her food intake?"),
            ("patient",
             "ما كتاكلش... كنطيبها ليها ملي كنرجع من الخدمة بصح مرات كتقولي ما بغيتش. وملي كنسولها واش كلاتي كتقولي ايه وهي ما كلاتش. كتنسا. وبدات كتنحف بزاف أختي، كيبان عليها.",
             "She's not eating... I cook for her when I get back from work but sometimes she says she doesn't want to. And when I ask if she ate she says yes but she hasn't. She forgets. And she's been losing weight a lot sister, you can see it."),
            ("ai",
             "واش كتنعس الوالدة مزيان بالليل؟",
             "Does your mother sleep well at night?"),
            ("patient",
             "والله البارح فاقتني 4 مرات. مرة وحدة بدات كتصيح بحال ما شافت شي حاجة. ما عارفا فين هي فدارها لي عاشت فيها 40 عام. وأنا ما بقيتش كننعس حتى أنا...",
             "Last night she woke me up 4 times. Once she started screaming like she saw something. She doesn't know where she is in the house she's lived in for 40 years. And I can't sleep anymore either..."),
            ("ai",
             "الله يعاونك خويا. واش قيستي ليها السكر هاد الأيام؟ شحال كان؟",
             "God help you brother. Did you check her blood sugar recently? What was it?"),
            ("patient",
             "قيستو قبل يومين، 210. بصح الأسبوع لي فات نزل ليها ل 55... بدات كترعد وكتعرق. خفت بزاف عطيتها عصير. الدكتور قال 55 خطير بزاف.",
             "I checked 2 days ago, 210. But last week it dropped to 55... She started shaking and sweating. I was so scared, I gave her juice. The doctor said 55 is very dangerous."),
            ("ai",
             "55 خطير بزاف ايه. خويا يوسف، واش وقعات شي حاجة أخرى هاد الأيام؟ واش الوالدة كتبقى فالدار؟",
             "55 is very dangerous yes. Brother Youssef, did anything else happen recently? Does your mother stay in the house?"),
            ("patient",
             "هاد الشي لي بغيت نقوليك عليه... قبل 3 أيام كنت فالخدمة. تصلو بيا الجيران قالولي لقينا الوالدة ديالك فالزنقة بالبيجامة ديالها. ما عارفا فين ساكنة. كانت تايهة أختي... والله كنموت من الخوف عليها.",
             "That's what I wanted to tell you... 3 days ago I was at work. The neighbors called me and said they found my mother in the street in her nightgown. She didn't know where she lives. She was lost sister... I swear I'm dying from fear for her."),
            ("ai",
             "خويا يوسف، هاد الشي خطير بزاف. واش كاين شي واحد كيبقا معاها نهار كامل ملي كتكون فالخدمة؟",
             "Brother Youssef, this is very serious. Is there someone who stays with her all day when you're at work?"),
            ("patient",
             "لا... بوحدها نهار كامل. 8 سوايع بوحدها. ما عنديش باش نخلص شي واحد يبقا معاها. ختي ساكنة فمراكش بعيدة. والله أختي ما عارف شنو ندير... أنا بوحدي ومالقيتش شكون يعاوني...",
             "No... She's alone all day. 8 hours alone. I can't afford to pay someone to stay with her. My sister lives in Marrakech, far away. I swear sister I don't know what to do... I'm alone and I can't find anyone to help me..."),
            ("ai",
             "خويا يوسف، سمعني مزيان. غادي نبلغ الدكتور على كلشي: الدوا لي كتخلطو، السكر لي نزل ل 55، أنها خرجات من الدار بوحدها، وأنها بوحدها نهار كامل. الدكتور غادي يتصل بيك ويشوف معاك الحلول. ما تبقاش بوحدك فهاد الشي خويا.",
             "Brother Youssef, listen to me carefully. I will inform the doctor about everything: the medication mix-ups, the blood sugar drop to 55, that she left the house alone, and that she's alone all day. The doctor will call you and work out solutions with you. You are not alone in this, brother."),
            ("patient",
             "الله يخليك أختي... شكرا بزاف... والله غير أنتوما لي تتسولو عليها. الله يجازيكم بخير.",
             "God bless you sister... Thank you so much... I swear you are the only ones who check on her. May God reward you."),
        ],
    },
]

DEMO_ALERTS = [
    {
        "patient_idx": 0,
        "call_idx": 0,
        "severity": "high",
        "alert_type": "blood_sugar_high",
        "title": "High blood sugar — Fatima Zahra El Amrani",
        "description": "Patient reports blood sugar of 320 mg/dL with missed insulin doses. Numbness in feet reported (possible neuropathy). Requires urgent review.",
    },
    {
        "patient_idx": 0,
        "call_idx": 0,
        "severity": "critical",
        "alert_type": "immediate_attention",
        "title": "URGENT: Fatima Zahra — diabetic neuropathy signs",
        "description": "Blood sugar 320 mg/dL combined with feet numbness. Missed insulin twice this week. High risk of diabetic complications.",
    },
    {
        "patient_idx": 5,
        "call_idx": 2,
        "severity": "medium",
        "alert_type": "medication_non_adherence",
        "title": "Medication non-adherence + vision issue — Omar Benjelloun",
        "description": "Patient skipping evening medication, blood sugar 180-250 range. Reports morning blurry vision — possible diabetic retinopathy. Eye exam referral recommended.",
    },
    {
        "patient_idx": 8,
        "call_idx": 3,
        "severity": "critical",
        "alert_type": "immediate_attention",
        "title": "CRITICAL: Malika Benmoussa — wandered out alone, severe hypo episode",
        "description": "Son reports: patient wandered out of house in nightgown 3 days ago (found by neighbors). Blood sugar crashed to 55 mg/dL last week. Mixing up medications. Alone 8hrs/day while son works. No professional caregiver. Immediate safety intervention required.",
    },
    {
        "patient_idx": 8,
        "call_idx": 3,
        "severity": "high",
        "alert_type": "caregiver_burnout",
        "title": "Caregiver burnout — Son of Malika Benmoussa overwhelmed",
        "description": "Son (Youssef) is sole caregiver, works full-time. Broke down during call. Cannot provide 24/7 care, cannot afford help. Sister lives far away. Needs caregiver support resources, respite care assessment, and possible social services referral.",
    },
]


async def seed():
    # Drop and re-create all tables (dev only — ensures schema is up to date)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check if doctor exists
        result = await db.execute(select(User).where(User.email == "doctor@test.com"))
        doctor = result.scalar_one_or_none()
        if not doctor:
            doctor = User(
                name="Dr. Amine Belkadi",
                email="doctor@test.com",
                password_hash=hash_password("test1234"),
                role="doctor",
                clinic_name="CHU Ibn Sina",
                phone="+212661000000",
            )
            db.add(doctor)
            await db.flush()
            await db.refresh(doctor)
            print(f"Created doctor: {doctor.email}")
        else:
            print(f"Doctor exists: {doctor.email}")

        # Check existing patients
        result = await db.execute(select(Patient).where(Patient.assigned_doctor_id == doctor.id))
        existing = result.scalars().all()
        existing_names = {p.name for p in existing}

        # Add patients
        patient_objs = list(existing)
        for p_data in DEMO_PATIENTS:
            if p_data["name"] in existing_names:
                # Find existing
                patient_objs.append(next(p for p in existing if p.name == p_data["name"]))
                continue
            p = Patient(**p_data, assigned_doctor_id=doctor.id)
            db.add(p)
            await db.flush()
            await db.refresh(p)
            patient_objs.append(p)
            print(f"  + Patient: {p.name} ({p.condition})")

        # Build patient lookup by index
        demo_patients = []
        for p_data in DEMO_PATIENTS:
            match = next((p for p in patient_objs if p.name == p_data["name"]), None)
            if match:
                demo_patients.append(match)

        # Add questions per patient
        for patient in demo_patients:
            # Check if questions already exist
            existing_q = await db.execute(
                select(PatientQuestion).where(PatientQuestion.patient_id == patient.id)
            )
            if existing_q.scalars().first():
                continue
            questions = get_default_questions_for_condition(patient.condition)
            for q in questions:
                pq = PatientQuestion(
                    patient_id=patient.id,
                    question_text=q["text"],
                    question_english=q["english"],
                    category=q["category"],
                    order=q["order"],
                )
                db.add(pq)
            await db.flush()
            print(f"  + {len(questions)} questions for {patient.name} ({patient.condition})")

        # Add calls
        call_objs = []
        for i, c_data in enumerate(DEMO_CALLS):
            patient = demo_patients[c_data["patient_idx"]]
            hours_ago = (len(DEMO_CALLS) - i) * 3  # Spread calls over past hours
            started = datetime.now(timezone.utc) - timedelta(hours=hours_ago)

            call = Call(
                patient_id=patient.id,
                status="completed",
                started_at=started,
                ended_at=started + timedelta(seconds=c_data["duration"]),
                duration_seconds=c_data["duration"],
                risk_score=c_data["risk_score"],
                summary=c_data["summary"],
                detected_symptoms=c_data["detected_symptoms"],
            )
            db.add(call)
            await db.flush()
            await db.refresh(call)
            call_objs.append(call)
            print(f"  + Call: {patient.name} (risk: {c_data['risk_score']})")

            # Add messages
            for j, (role, darija, english) in enumerate(c_data["messages"]):
                msg = CallMessage(
                    call_id=call.id,
                    role=role,
                    content_darija=darija,
                    content_english=english,
                    timestamp=started + timedelta(seconds=j * 25),
                )
                db.add(msg)
            await db.flush()

        # Add alerts
        for a_data in DEMO_ALERTS:
            patient = demo_patients[a_data["patient_idx"]]
            call = call_objs[a_data["call_idx"]]
            alert = Alert(
                call_id=call.id,
                patient_id=patient.id,
                severity=a_data["severity"],
                alert_type=a_data["alert_type"],
                title=a_data["title"],
                description=a_data["description"],
            )
            db.add(alert)
            print(f"  + Alert: {a_data['title'][:50]}...")

        await db.commit()
        print("\nDemo data seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
