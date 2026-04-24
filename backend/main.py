import os
import time
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

# LangChain Imports
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_classic.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
# Database Imports
from database import SessionLocal, ChatSession, ChatMessage
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


load_dotenv()


api_key = os.getenv("GOOGLE_API_KEY")

#
os.environ["GOOGLE_API_KEY"] = api_key

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class QuestionRequest(BaseModel):
    question: str

# --- 1. GET ALL PREVIOUS SESSIONS ---
@app.get("/sessions")
def get_all_sessions(db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).order_by(ChatSession.created_at.desc()).all()
    return sessions

# --- 2. GET HISTORY FOR A SPECIFIC SESSION ---
@app.get("/history/{session_id}")
def get_chat_history(session_id: int, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).all()
    return [{"role": m.role, "text": m.content} for m in messages]

# --- 3. UPLOAD & CREATE NEW SESSION ---
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        # Create DB entry for session
        new_session = ChatSession(filename=file.filename)
        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        # Save PDF
        os.makedirs("temp", exist_ok=True)
        file_path = f"temp/{new_session.id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Process PDF
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)
        chunks = splitter.split_documents(docs)

        embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
        
        # Build Vector DB
        vector_db = FAISS.from_documents([chunks[0]], embeddings)
        for i in range(1, len(chunks)):
            vector_db.add_documents([chunks[i]])
            if i % 5 == 0: time.sleep(1) # Rate limit safety

        # PERMANENTLY SAVE FAISS INDEX
        os.makedirs("vectors", exist_ok=True)
        vector_db.save_local(f"vectors/session_{new_session.id}")
            
        return {"session_id": new_session.id, "filename": file.filename}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- 4. ASK QUESTION (WITH PERSISTENCE) ---
@app.post("/ask/{session_id}")
async def ask_question(session_id: int, request: QuestionRequest, db: Session = Depends(get_db)):
    vector_path = f"vectors/session_{session_id}"
    if not os.path.exists(vector_path):
        raise HTTPException(status_code=404, detail="Session data not found")

    # Load the specific vector index for this session
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
    vector_db = FAISS.load_local(vector_path, embeddings, allow_dangerous_deserialization=True)

    llm = ChatGoogleGenerativeAI(model="models/gemini-3-flash-preview")
    
    template = """You are a helpful assistant. Use the following context to answer.
    Context: {context}
    Question: {question}
    Answer:"""
    prompt = PromptTemplate(template=template, input_variables=["context", "question"])

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=vector_db.as_retriever(search_kwargs={"k": 5}),
        chain_type_kwargs={"prompt": prompt}
    )

    response = qa_chain.invoke(request.question)
    answer = response["result"]

    # Save messages to database
    user_msg = ChatMessage(session_id=session_id, role="user", content=request.question)
    bot_msg = ChatMessage(session_id=session_id, role="bot", content=answer)
    db.add_all([user_msg, bot_msg])
    db.commit()

    return {"answer": answer}

@app.delete("/session/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    try:
        # 1. Delete messages first (Foreign Key constraint)
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
        # 2. Delete the session
        db.query(ChatSession).filter(ChatSession.id == session_id).delete()
        db.commit()

        # 3. Delete the vector folder
        vector_path = f"vectors/session_{session_id}"
        if os.path.exists(vector_path):
            shutil.rmtree(vector_path)

        return {"message": "Deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)