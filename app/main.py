from fastapi import FastAPI # type: ignore
from services.email_analyzer import analyze_email
from pydantic import BaseModel # type: ignore

app = FastAPI(title="Email Warmup")

class EmailRequest(BaseModel):
    subject: str = ""
    body: str

@app.post("/analyze")
def analyze(email: EmailRequest):
    # Combine subject + body for better accuracy
    text = f"{email.subject}\n\n{email.body}"
    result = analyze_email(text, email.subject)  # Pass subject separately
    return {"subject": email.subject, "result": result}