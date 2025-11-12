from fastapi import FastAPI # type: ignore
from services.email_analyzer import analyze_email
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel # type: ignore

app = FastAPI(title="Email Warmup")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EmailRequest(BaseModel):
    subject: str = ""
    body: str

@app.post("/analyze")
def analyze(email: EmailRequest):
    # Combine subject + body for better accuracy
    text = f"{email.subject}\n\n{email.body}"
    result = analyze_email(text, email.subject)  # Pass subject separately
    return {"subject": email.subject, "result": result}