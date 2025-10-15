# from fastapi import FastAPI, APIRouter, HTTPException
# from dotenv import load_dotenv
# from starlette.middleware.cors import CORSMiddleware
# from motor.motor_asyncio import AsyncIOMotorClient
# import os
# import logging
# from pathlib import Path
# from pydantic import BaseModel, Field
# from typing import List
# import uuid
# from datetime import datetime, timezone
# from emergentintegrations.llm.chat import LlmChat, UserMessage




# ROOT_DIR = Path(__file__).parent
# load_dotenv(ROOT_DIR / '.env')

# # MongoDB connection
# mongo_url = os.environ['MONGO_URL']
# client = AsyncIOMotorClient(mongo_url)
# db = client[os.environ['DB_NAME']]

# # Create the main app without a prefix
# app = FastAPI()

# # Create a router with the /api prefix
# api_router = APIRouter(prefix="/api")

# # Define Models
# class EmailRequest(BaseModel):
#     industry: str

# class GeneratedEmail(BaseModel):
#     id: str = Field(default_factory=lambda: str(uuid.uuid4()))
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# class EmailResponse(BaseModel):
#     id: str
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime

# # Helper functions
# def prepare_for_mongo(data):
#     if isinstance(data.get('timestamp'), datetime):
#         data['timestamp'] = data['timestamp'].isoformat()
#     return data

# def parse_from_mongo(item):
#     if isinstance(item.get('timestamp'), str):
#         item['timestamp'] = datetime.fromisoformat(item['timestamp'])
#     return item

# # Initialize LLM Chat
# def get_llm_chat():
#     return LlmChat(
#         api_key=os.environ.get('EMERGENT_LLM_KEY'),
#         session_id="warmup-email-generator",
#         system_message="You are a professional email marketing expert specializing in creating effective warmup emails for various industries. Create engaging, personalized warmup emails that help build relationships and establish credibility."
#     ).with_model("openai", "gpt-4o-mini")

# @api_router.get("/")
# async def root():
#     return {"message": "Warmup Email Generator API"}

# @api_router.post("/generate-email", response_model=EmailResponse)
# async def generate_warmup_email(request: EmailRequest):
#     try:
#         # Create the prompt for generating warmup email
#         prompt = f"""Generate a professional warmup email for the {request.industry} industry. 
#         The email should be:
#         1. Warm and friendly but professional
#         2. Industry-specific and relevant
#         3. Focused on building relationships
#         4. Include a clear value proposition
#         5. Have a compelling subject line
#         6. Be concise (200-300 words)
        
#         Format your response as JSON with two fields:
#         - "subject": The email subject line
#         - "content": The email body content
        
#         Make sure the email feels authentic and personalized for someone in the {request.industry} industry."""
        
#         # Get LLM chat instance
#         chat = get_llm_chat()
        
#         # Create user message
#         user_message = UserMessage(text=prompt)
        
#         # Get response from LLM
#         response = await chat.send_message(user_message)
        
#         # Parse the response - assuming it returns a string
#         import json
#         try:
#             # Try to extract JSON from the response
#             response_text = str(response)
#             # Find JSON in the response
#             start_idx = response_text.find('{')
#             end_idx = response_text.rfind('}') + 1
#             if start_idx != -1 and end_idx != 0:
#                 json_str = response_text[start_idx:end_idx]
#                 parsed_response = json.loads(json_str)
#                 subject = parsed_response.get("subject", f"Let's connect - {request.industry} insights")
#                 content = parsed_response.get("content", f"Hi there,\n\nI hope this email finds you well. I'm reaching out to connect with fellow professionals in the {request.industry} industry...")
#             else:
#                 # Fallback if JSON parsing fails
#                 subject = f"Let's connect - {request.industry} insights"
#                 content = str(response)
#         except:
#             # Fallback response
#             subject = f"Let's connect - {request.industry} insights"
#             content = str(response)
        
#         # Create email object
#         email = GeneratedEmail(
#             industry=request.industry,
#             subject=subject,
#             content=content
#         )
        
#         # Store in database
#         email_dict = prepare_for_mongo(email.dict())
#         await db.generated_emails.insert_one(email_dict)
        
#         return EmailResponse(**email.dict())
        
#     except Exception as e:
#         logger.error(f"Error generating email: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to generate email: {str(e)}")

# @api_router.get("/emails", response_model=List[EmailResponse])
# async def get_generated_emails():
#     try:
#         emails = await db.generated_emails.find().sort("timestamp", -1).limit(50).to_list(length=None)
#         parsed_emails = [parse_from_mongo(email) for email in emails]
#         return [EmailResponse(**email) for email in parsed_emails]
#     except Exception as e:
#         logger.error(f"Error fetching emails: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to fetch emails")

# # Include the router in the main app
# app.include_router(api_router)

# app.add_middleware(
#     CORSMiddleware,
#     allow_credentials=True,
#     allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Configure logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)

# @app.on_event("shutdown")
# async def shutdown_db_client():
#     client.close()


# from fastapi import FastAPI, APIRouter, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from contextlib import asynccontextmanager
# from dotenv import load_dotenv
# from pathlib import Path
# import os, logging, uuid
# from datetime import datetime, timezone
# from pydantic import BaseModel, Field
# from typing import List
# from emergentintegrations.llm.chat import LlmChat, UserMessage
# from motor.motor_asyncio import AsyncIOMotorClient
# import json

# # --- Load env ---
# ROOT_DIR = Path(__file__).parent
# load_dotenv(ROOT_DIR / '.env')

# # --- MongoDB ---
# mongo_url = os.environ['MONGO_URL']
# client = AsyncIOMotorClient(mongo_url)
# db = client[os.environ['DB_NAME']]

# # --- Logging ---
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # --- FastAPI lifespan ---
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Startup logic if needed
#     yield
#     # Shutdown
#     client.close()

# # --- App ---
# app = FastAPI(lifespan=lifespan)

# # --- CORS ---
# app.add_middleware(
#     CORSMiddleware,
#     allow_credentials=True,
#     allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # --- Router ---
# api_router = APIRouter(prefix="/api")

# # --- Models ---
# class EmailRequest(BaseModel):
#     industry: str

# class GeneratedEmail(BaseModel):
#     id: str = Field(default_factory=lambda: str(uuid.uuid4()))
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# class EmailResponse(BaseModel):
#     id: str
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime

# def prepare_for_mongo(data):
#     if isinstance(data.get('timestamp'), datetime):
#         data['timestamp'] = data['timestamp'].isoformat()
#     return data

# def parse_from_mongo(item):
#     if isinstance(item.get('timestamp'), str):
#         item['timestamp'] = datetime.fromisoformat(item['timestamp'])
#     return item

# def get_llm_chat():
#     chat = LlmChat(
#         session_id="warmup-email-generator",
#         system_message="You are a professional email marketing expert..."
#     )
#     chat.set_api_key(os.environ.get('EMERGENT_LLM_KEY'))
#     return chat.with_model("openai", "gpt-4o-mini")


# # --- Endpoints ---
# @api_router.get("/")
# async def root():
#     return {"message": "Warmup Email Generator API"}

# @api_router.post("/generate-email", response_model=EmailResponse)
# async def generate_warmup_email(request: EmailRequest):
#     try:
#         prompt = f"Generate a professional warmup email for {request.industry} industry..."
#         chat = get_llm_chat()
#         user_message = UserMessage(text=prompt)
#         response = await chat.send_message(user_message)
#         # Parse JSON response
#         try:
#             response_text = str(response)
#             start_idx = response_text.find('{')
#             end_idx = response_text.rfind('}') + 1
#             if start_idx != -1 and end_idx != 0:
#                 json_str = response_text[start_idx:end_idx]
#                 parsed_response = json.loads(json_str)
#                 subject = parsed_response.get("subject", f"Let's connect - {request.industry} insights")
#                 content = parsed_response.get("content", f"Hi there, connecting with {request.industry} pros...")
#             else:
#                 subject = f"Let's connect - {request.industry} insights"
#                 content = str(response)
#         except:
#             subject = f"Let's connect - {request.industry} insights"
#             content = str(response)

#         email = GeneratedEmail(industry=request.industry, subject=subject, content=content)
#         await db.generated_emails.insert_one(prepare_for_mongo(email.dict()))
#         return EmailResponse(**email.dict())
#     except Exception as e:
#         logger.error(f"Error generating email: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @api_router.get("/emails", response_model=List[EmailResponse])
# async def get_generated_emails():
#     try:
#         emails = await db.generated_emails.find().sort("timestamp", -1).limit(50).to_list(length=None)
#         parsed_emails = [parse_from_mongo(e) for e in emails]
#         return [EmailResponse(**e) for e in parsed_emails]
#     except Exception as e:
#         logger.error(f"Error fetching emails: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to fetch emails")

# # --- Include router ---
# app.include_router(api_router)

# # --- Run ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

# from fastapi import FastAPI, APIRouter, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from contextlib import asynccontextmanager
# from dotenv import load_dotenv
# from pathlib import Path
# import os, logging, uuid
# from datetime import datetime, timezone
# from pydantic import BaseModel, Field
# from typing import List
# from motor.motor_asyncio import AsyncIOMotorClient
# import openai
# import json

# # --- Load env ---
# ROOT_DIR = Path(__file__).parent
# load_dotenv(ROOT_DIR / '.env')

# # --- MongoDB ---
# mongo_url = os.environ['MONGO_URL']
# client = AsyncIOMotorClient(mongo_url)
# db = client[os.environ['DB_NAME']]

# # --- Logging ---
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # --- FastAPI lifespan ---
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     yield
#     client.close()

# # --- App ---
# app = FastAPI(lifespan=lifespan)

# # --- CORS ---
# app.add_middleware(
#     CORSMiddleware,
#     allow_credentials=True,
#     allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # --- Router ---
# api_router = APIRouter(prefix="/api")

# # --- Models ---
# class EmailRequest(BaseModel):
#     industry: str

# class GeneratedEmail(BaseModel):
#     id: str = Field(default_factory=lambda: str(uuid.uuid4()))
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# class EmailResponse(BaseModel):
#     id: str
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime

# def prepare_for_mongo(data):
#     if isinstance(data.get('timestamp'), datetime):
#         data['timestamp'] = data['timestamp'].isoformat()
#     return data

# def parse_from_mongo(item):
#     if isinstance(item.get('timestamp'), str):
#         item['timestamp'] = datetime.fromisoformat(item['timestamp'])
#     return item

# async def generate_email_from_openai(industry: str):
#     prompt = f"Generate a professional warmup email for {industry} industry. Return JSON with 'subject' and 'content'."
#     try:
#         response = await openai.ChatCompletion.acreate(
#             model="gpt-4o-mini",
#             messages=[
#                 {"role": "system", "content": "You are a professional email marketing expert."},
#                 {"role": "user", "content": prompt}
#             ],
#             temperature=0.7
#         )
#         content = response.choices[0].message.content
#         # Parse JSON
#         start_idx = content.find('{')
#         end_idx = content.rfind('}') + 1
#         if start_idx != -1 and end_idx != 0:
#             parsed = json.loads(content[start_idx:end_idx])
#             subject = parsed.get("subject", f"Let's connect - {industry} insights")
#             body = parsed.get("content", f"Hi there, connecting with {industry} pros...")
#         else:
#             subject = f"Let's connect - {industry} insights"
#             body = content
#         return subject, body
#     except Exception as e:
#         logger.error(f"OpenAI API error: {str(e)}")
#         return f"Let's connect - {industry} insights", f"Hi there, connecting with {industry} pros..."

# # --- Endpoints ---
# @api_router.get("/")
# async def root():
#     return {"message": "Warmup Email Generator API"}

# @api_router.post("/generate-email", response_model=EmailResponse)
# async def generate_warmup_email(request: EmailRequest):
#     try:
#         subject, content = await generate_email_from_openai(request.industry)
#         email = GeneratedEmail(industry=request.industry, subject=subject, content=content)
#         await db.generated_emails.insert_one(prepare_for_mongo(email.dict()))
#         return EmailResponse(**email.dict())
#     except Exception as e:
#         logger.error(f"Error generating email: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @api_router.get("/emails", response_model=List[EmailResponse])
# async def get_generated_emails():
#     try:
#         emails = await db.generated_emails.find().sort("timestamp", -1).limit(50).to_list(length=None)
#         parsed_emails = [parse_from_mongo(e) for e in emails]
#         return [EmailResponse(**e) for e in parsed_emails]
#     except Exception as e:
#         logger.error(f"Error fetching emails: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to fetch emails")

# # --- Include router ---
# app.include_router(api_router)

# # --- Run ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)



# from fastapi import FastAPI, APIRouter, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from contextlib import asynccontextmanager
# from dotenv import load_dotenv
# from pathlib import Path
# import os, logging, uuid
# from datetime import datetime, timezone
# from pydantic import BaseModel, Field
# from typing import List
# from motor.motor_asyncio import AsyncIOMotorClient
# import openai
# import json

# # --- Load env ---
# ROOT_DIR = Path(__file__).parent
# load_dotenv(ROOT_DIR / '.env')

# # --- MongoDB ---
# mongo_url = os.environ['MONGO_URL']
# client = AsyncIOMotorClient(mongo_url)
# db = client[os.environ['DB_NAME']]

# # --- Logging ---
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # --- FastAPI lifespan ---
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     yield
#     client.close()

# # --- App ---
# app = FastAPI(lifespan=lifespan)

# # --- CORS ---
# app.add_middleware(
#     CORSMiddleware,
#     allow_credentials=True,
#     allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # --- Router ---
# api_router = APIRouter(prefix="/api")

# # --- Models ---
# class EmailRequest(BaseModel):
#     sender_name: str
#     receiver_name: str  
#     industry: str

# class GeneratedEmail(BaseModel):
#     id: str = Field(default_factory=lambda: str(uuid.uuid4()))
#     sender_name: str
#     receiver_name: str
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# class EmailResponse(BaseModel):
#     id: str
#     sender_name: str
#     receiver_name: str
#     industry: str
#     subject: str
#     content: str
#     timestamp: datetime

# # --- Models for replies ---
# class ReplyEmailRequest(BaseModel):
#     email_id: str

# class ReplyEmailResponse(BaseModel):
#     id: str
#     email_id: str
#     reply_content: str
#     timestamp: datetime

# # --- Helper functions ---
# def prepare_for_mongo(data):
#     if isinstance(data.get('timestamp'), datetime):
#         data['timestamp'] = data['timestamp'].isoformat()
#     return data

# def parse_from_mongo(item):
#     if isinstance(item.get('timestamp'), str):
#         item['timestamp'] = datetime.fromisoformat(item['timestamp'])
#     return item

# # --- OpenAI email generation ---
# async def generate_email_from_openai(sender_name: str, receiver_name: str, industry: str):
#     prompt = (
#         f"Generate a professional warmup email from {sender_name} to {receiver_name} "
#         f"for the {industry} industry. Return JSON with 'subject' and 'content'. "
#         "Keep it warm and friendly."
#     )
#     try:
#         response = await openai.ChatCompletion.acreate(
#             model="gpt-4o-mini",
#             messages=[
#                 {"role": "system", "content": "You are a professional email marketing expert."},
#                 {"role": "user", "content": prompt}
#             ],
#             temperature=0.7
#         )
#         content = response.choices[0].message.content
#         start_idx = content.find('{')
#         end_idx = content.rfind('}') + 1
#         if start_idx != -1 and end_idx != 0:
#             parsed = json.loads(content[start_idx:end_idx])
#             subject = parsed.get("subject", f"Let's connect - {industry} insights")
#             body = parsed.get("content", f"Hi {receiver_name}, connecting with {industry} pros...")
#         else:
#             subject = f"Let's connect - {industry} insights"
#             body = content
#         return subject, body
#     except Exception as e:
#         logger.error(f"OpenAI API error: {str(e)}")
#         return f"Let's connect - {industry} insights", f"Hi {receiver_name}, connecting with {industry} pros..."

# # --- Endpoints ---
# @api_router.get("/")
# async def root():
#     return {"message": "Warmup Email Generator API"}
# @api_router.post("/generate-email", response_model=EmailResponse)
# async def generate_warmup_email(request: EmailRequest):
#     try:
#         subject, content = await generate_email_from_openai(
#             request.sender_name,
#             request.receiver_name,
#             request.industry
#         )
#         email = GeneratedEmail(
#             sender_name=request.sender_name,
#             receiver_name=request.receiver_name,
#             industry=request.industry,
#             subject=subject,
#             content=content
#         )
#         await db.generated_emails.insert_one(prepare_for_mongo(email.dict()))
#         return EmailResponse(**email.dict())
#     except Exception as e:
#         logger.error(f"Error generating email: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# # --- Reply endpoints ---
# @api_router.post("/reply-email", response_model=ReplyEmailResponse)
# async def reply_email(request: ReplyEmailRequest):
#     try:
#         # Fetch original email
#         email = await db.generated_emails.find_one({"id": request.email_id})
#         if not email:
#             raise HTTPException(status_code=404, detail="Original email not found")

#         parsed_email = parse_from_mongo(email)
#         original_content = parsed_email["content"]
#         sender_name = parsed_email["sender_name"]
#         receiver_name = parsed_email["receiver_name"]
#         industry = parsed_email["industry"]

#         # Generate reply using OpenAI
#         prompt = (
#             f"Reply professionally to the following email from {sender_name} to {receiver_name} "
#             f"in the {industry} industry:\n\n{original_content}\n\nKeep it warm, friendly, and concise."
#         )
#         response = await openai.ChatCompletion.acreate(
#             model="gpt-4o-mini",
#             messages=[
#                 {"role": "system", "content": "You are a professional email assistant."},
#                 {"role": "user", "content": prompt}
#             ],
#             temperature=0.7
#         )
#         reply_text = response.choices[0].message.content

#         # Create reply object
#         reply = {
#             "id": str(uuid.uuid4()),
#             "email_id": request.email_id,
#             "reply_content": reply_text,
#             "timestamp": datetime.now(timezone.utc)
#         }

#         await db.email_replies.insert_one(prepare_for_mongo(reply))
#         return ReplyEmailResponse(**reply)
#     except Exception as e:
#         logger.error(f"Error generating reply: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# # --- Include router ---
# app.include_router(api_router)

# # --- Run ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)



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
