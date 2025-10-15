



from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from pathlib import Path
import os, logging, uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import List
import openai
import json

# --- MySQL ---
from databases import Database
from sqlalchemy import  MetaData, Table, Column, String, DateTime

# --- Load env ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- MySQL setup ---
mysql_url = f"mysql+aiomysql://{os.environ['MYSQL_USER']}:{os.environ['MYSQL_PASSWORD']}@{os.environ['MYSQL_HOST']}:{os.environ['MYSQL_PORT']}/{os.environ['MYSQL_DB']}"
database = Database(mysql_url)
metadata = MetaData()

# Table definitions
generated_emails = Table(
    "generated_emails",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("sender_name", String(255)),
    Column("receiver_name", String(255)),
    Column("industry", String(255)),
    Column("subject", String(255)),
    Column("content", String(2000)),
    Column("timestamp", DateTime),
)

email_replies = Table(
    "email_replies",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("email_id", String(36)),
    Column("reply_content", String(2000)),
    Column("timestamp", DateTime),
)


# --- FastAPI lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    yield
    await database.disconnect()

# --- App ---
app = FastAPI(lifespan=lifespan)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router ---
api_router = APIRouter(prefix="/api")

# --- Models ---
class EmailRequest(BaseModel):
    sender_name: str
    receiver_name: str  
    industry: str

class GeneratedEmail(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_name: str
    receiver_name: str
    industry: str
    subject: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmailResponse(BaseModel):
    id: str
    sender_name: str
    receiver_name: str
    industry: str
    subject: str
    content: str
    timestamp: datetime

# --- Models for replies ---
class ReplyEmailRequest(BaseModel):
    email_id: str

class ReplyEmailResponse(BaseModel):
    id: str
    email_id: str
    reply_content: str
    timestamp: datetime

# --- OpenAI email generation ---
async def generate_email_from_openai(sender_name: str, receiver_name: str, industry: str):
    prompt = (
        f"Generate a professional warmup email from {sender_name} to {receiver_name} "
        f"for the {industry} industry. Return JSON with 'subject' and 'content'. "
        "Keep it warm and friendly."
    )
    try:
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional email marketing expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        content = response.choices[0].message.content
        start_idx = content.find('{')
        end_idx = content.rfind('}') + 1
        if start_idx != -1 and end_idx != 0:
            parsed = json.loads(content[start_idx:end_idx])
            subject = parsed.get("subject", f"Let's connect - {industry} insights")
            body = parsed.get("content", f"Hi {receiver_name}, connecting with {industry} pros...")
        else:
            subject = f"Let's connect - {industry} insights"
            body = content
        return subject, body
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        return f"Let's connect - {industry} insights", f"Hi {receiver_name}, connecting with {industry} pros..."

# --- Endpoints ---
@api_router.get("/")
async def root():
    return {"message": "Warmup Email Generator API"}

@api_router.post("/generate-email", response_model=EmailResponse)
async def generate_warmup_email(request: EmailRequest):
    try:
        subject, content = await generate_email_from_openai(
            request.sender_name,
            request.receiver_name,
            request.industry
        )
        email = GeneratedEmail(
            sender_name=request.sender_name,
            receiver_name=request.receiver_name,
            industry=request.industry,
            subject=subject,
            content=content
        )
        # Save to MySQL
        query = generated_emails.insert().values(**email.dict())
        await database.execute(query)
        return EmailResponse(**email.dict())
    except Exception as e:
        logger.error(f"Error generating email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Reply endpoints ---
@api_router.post("/reply-email", response_model=ReplyEmailResponse)
async def reply_email(request: ReplyEmailRequest):
    try:
        # Fetch original email
        query = generated_emails.select().where(generated_emails.c.id == request.email_id)
        email = await database.fetch_one(query)
        if not email:
            raise HTTPException(status_code=404, detail="Original email not found")

        sender_name = email["sender_name"]
        receiver_name = email["receiver_name"]
        industry = email["industry"]
        original_content = email["content"]

        # Generate reply using OpenAI
        prompt = (
            f"Reply professionally to the following email from {sender_name} to {receiver_name} "
            f"in the {industry} industry:\n\n{original_content}\n\nKeep it warm, friendly, and concise."
        )
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional email assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        reply_text = response.choices[0].message.content

        # Create reply object
        reply = {
            "id": str(uuid.uuid4()),
            "email_id": request.email_id,
            "reply_content": reply_text,
            "timestamp": datetime.now(timezone.utc)
        }

        # Save reply to MySQL
        query = email_replies.insert().values(**reply)
        await database.execute(query)
        return ReplyEmailResponse(**reply)
    except Exception as e:
        logger.error(f"Error generating reply: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Include router ---
app.include_router(api_router)

# --- Run ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
