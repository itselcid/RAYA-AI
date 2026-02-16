# RAYA — Q&A Cheat Sheet (2 minutes)


## CLINICAL / MEDICAL QUESTIONS

**Q: "How does this work with real phone calls?"**
> In production, we plug in Twilio or Infobip. ElevenLabs speaks to the patient, MiniMax transcribes their response and generates the next question. For this demo we built a web simulator — but the AI pipeline is the same. It's ready to plug into real telephony.

**Q: "What if the patient doesn't answer?"**
> RAYA retries up to 3 times. If still no answer, it marks the call as "missed" in the queue and alerts the doctor to follow up manually. No patient falls through the cracks.

**Q: "What if the AI doesn't understand what the patient says?"**
> We built a 3-step fallback. First, it politely asks the patient to repeat. Second, it rephrases the question in simpler words. Third, if still unclear, it tells the patient "I'll have your doctor contact you" and moves on. The answer is flagged as "unclear" so the doctor knows to personally follow up on that question.

**Q: "Can the AI give wrong medical advice?"**
> It can't — because it's not allowed to. RAYA never diagnoses, never interprets, never recommends. It ONLY asks the questions the doctor configured, records the answers, and summarizes. The doctor makes every medical decision. The AI is a phone assistant, not a doctor.

**Q: "Why Darija and not standard Arabic or French?"**
> Because 95% of Moroccan patients speak Darija at home. If you call a 70-year-old diabetic grandmother in standard Arabic, she won't feel comfortable. Darija builds trust. The patient opens up more, gives more honest answers. That's clinically better data for the doctor.

**Q: "Is this only for diabetes?"**
> No. RAYA works for any condition. We have presets for diabetes, hypertension, Alzheimer's, chemotherapy, post-surgery, asthma, and heart failure. And the doctor can add custom questions for any condition we haven't covered. It's a general follow-up platform, not a single-disease tool.

**Q: "How do you validate the medical questions?"**
> The questions are not AI-generated — the DOCTOR writes them, or picks from evidence-based presets we built with medical input from Oussama. The AI only asks what the doctor approved. This is the key design choice: doctor in control, AI as a tool.

**Q: "What about elderly patients who can't use a phone well?"**
> That's exactly why we use phone CALLS, not an app. The patient doesn't need to download anything, no smartphone required. RAYA calls their regular phone numhttps://github.com/itselcid/CureCodeber. They just pick up and talk. For Alzheimer's patients, we even ask "Is someone with you at home?" as a safety check.

---

## TECHNICAL QUESTIONS

**Q: "What's your tech stack?"**
> Next.js 16 frontend, FastAPI backend, SQLite database. MiniMax for LLM conversations and risk analysis, ElevenLabs for Arabic text-to-speech. Everything built with Cursor in 48 hours.

**Q: "How does the AI know what to ask?"**https://github.com/itselcid/CureCode
> The doctor configures a list of questions per patient. We inject those into the AI's system prompt dynamically. The AI gets strict instructions: ask these questions in this order, don't add your own, don't give advice. After the call, a separate MiniMax prompt analyzes the transcript and generates a risk score.

**Q: "How do you handle the call ending?"**
> The AI tracks which questions it has asked. After the last answer, it says goodbye in Darija and sends a special signal. The system automatically ends the call and triggers the risk analysis. The doctor doesn't need to manually click anything.

**Q: "How does the risk analysis work?"**
> After the call, we send the full transcript plus patient context to MiniMax with an analysis prompt. It returns a JSON with: risk score (0-100%), per-question concern levels (ok/monitor/concerning/urgent/unclear), detected symptoms, and recommendations. The doctor sees all this and makes the final call — approve, escalate to alert, or dismiss.

**Q: "How did you use Cursor?"**
> Cursor built everything — the entire codebase, all 50+ files, both backend and frontend. Database models, API endpoints, AI prompts, the full React UI. We went from zero to working product in 48 hours. Without Cursor's AI assistance, this would have taken 2-3 weeks.

**Q: "How did you use MiniMax?"**
> Three ways. First, as the conversational LLM — it generates Darija responses during the call. Second, for translation — it translates Darija to English so the doctor can read the transcript. Third, for risk analysis — it evaluates the entire call and generates a structured medical risk assessment.

**Q: "How did you use ElevenLabs?"**
> For text-to-speech. When the AI generates a Darija response, ElevenLabs converts it to natural Arabic speech. The patient hears a warm, natural voice — not a robotic one. This is critical for trust, especially with elderly patients.

---

## BUSINESS / ENTREPRENEURSHIP QUESTIONS

**Q: "Who is your customer?"**
> Hospitals and private clinics in Morocco. Specifically, departments that manage chronic patients — endocrinology (diabetes), oncology (chemo), neurology (Alzheimer's), and general surgery (post-op). Our first target is private clinics in Casablanca and Rabat.

**Q: "What's your business model?"**
> B2B SaaS. Hospitals pay a monthly subscription per patient enrolled. Three tiers — Basic for weekly calls, Pro for daily calls plus analytics, Enterprise for custom integrations. A hospital with 200 patients would pay roughly 10,000-20,000 MAD/month.

**Q: "Why would a hospital pay for this?"**
> Three reasons. One, readmissions are expensive — a single diabetes readmission costs 15,000 to 50,000 MAD. If we prevent just 5 per month, we save them 75,000-250,000 MAD. Two, accreditation — hospitals with follow-up programs score better. Three, patient satisfaction — patients feel cared for, they recommend the hospital.

**Q: "What's the market size?"**
> Morocco has 32 million people on AMO health insurance, 150+ hospitals, 2,500+ clinics. Just the diabetic population is 2.7 million. If we capture 1% of chronic patients at 50 MAD/patient/month, that's 16 million MAD annual revenue in Morocco alone.

**Q: "How do you scale beyond Morocco?"**
> Three expansion paths. Gulf countries — same Arabic language, much bigger healthcare budgets. France — 1.5 million Moroccan diaspora, French healthcare system reimburses telehealth. Sub-Saharan Africa — similar doctor shortage problem, we add local languages.

**Q: "What's your competitive advantage?"**
> Three things nobody else has. One, Darija — no competitor speaks Moroccan Arabic naturally. Two, doctor control — the AI follows the doctor's exact questions, it doesn't freelance. Three, any condition — diabetes, Alzheimer's, chemo, surgery, not locked to one disease.

**Q: "What about patient data privacy?"**
> Patient data stays on the hospital's own infrastructure. We comply with Morocco's CNDP data protection law (Law 09-08). Call audio is processed in real-time and not stored permanently — only the text summary goes to the doctor's dashboard. We can also deploy on-premise for sensitive hospitals.

**Q: "What's your roadmap?"**
> Next 3 months: pilot with 2-3 private clinics in Casablanca. Next 6 months: integrate real phone calls via Infobip, add medication reminders. Next 12 months: family caregiver dashboard so relatives can see their parent's follow-up status. Then expand to Gulf markets.

---

## TRICKY / SKEPTICAL QUESTIONS

**Q: "Isn't this just a chatbot with a phone number?"**
> No. Three critical differences. One, it's doctor-configured — every question is chosen by the doctor, not AI. Two, it has medical risk analysis — after the call, MiniMax evaluates symptoms and assigns concern levels. Three, the doctor reviews everything — approve, escalate, or dismiss. It's a clinical workflow tool, not a chatbot.

**Q: "Why not just hire nurses to make these calls?"**
> Because Morocco doesn't have enough. 6.7 doctors per 10,000 people, even fewer nurses. A nurse can make maybe 20 calls a day. RAYA can make 200. And it calls at exactly the time the doctor set, never forgets, never gets tired, speaks perfect Darija every time.

**Q: "What if patients don't trust an AI calling them?"**
> Great question. That's why RAYA introduces itself as calling "on behalf of your doctor" — not as an AI. The voice is warm and natural (ElevenLabs). It speaks their language (Darija). It asks about their health (which they care about). In our tests, patients engage naturally because the experience feels like a caring phone call, not a robot.

**Q: "You built this in 48 hours — is it production ready?"**
> The core AI pipeline works — conversations, analysis, doctor review. For production we'd need real telephony integration (Twilio/Infobip), load testing, and security hardening. But the architecture is designed for it. We estimate 4-6 weeks to a production pilot.
