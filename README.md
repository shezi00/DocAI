DocAI: Retrieval-Augmented Generation (RAG) System
DocAI is a full-stack AI application that allows users to upload PDF documents and have intelligent conversations
about their content. By leveraging RAG architecture, the system retrieves specific context from uploaded documents
to provide accurate, source-backed answers using Google's Gemini API.

Features:
PDF Processing: Extracts and chunks text from uploaded PDF files.
Vector Search: Uses FAISS/Chroma to index document embeddings for fast retrieval.
AI Chat: Powered by Google Gemini Pro for natural language understanding.
Session Management: Stores chat history in a SQLite database via SQLAlchemy.
Modern UI: A responsive frontend built with React and Vite.

Tech Stack:
Frontend: React.js, Vite,CSS
Backend: FastAPI (Python)
AI/LLM: Google Generative AI (Gemini), LangChain
Database: SQLite, SQLAlchemy
Vector Store: FAISS / LangChain Vector Stores

Installation & Setup:
1. Clone the Repository
git clone https://github.com/shezi00/DocAI.git
cd DocAI

3. Backend Setup
Navigate to the backend folder:
cd backend
Create a virtual environment and activate it:
python -m venv venv

On Windows:
.\venv\Scripts\activate
Install dependencies:
pip install -r requirements.txt
Create a .env file and add your Google API Key:
GOOGLE_API_KEY=your_actual_api_key_here
3. Frontend Setup
Navigate to the frontend folder:
cd ../frontend/vite-project
Install dependencies:
npm install
Start the development server:
npm run dev

Project Structure:
react_rag/
├── backend/
│   ├── main.py          # FastAPI application & RAG logic
│   ├── database.py      # SQLAlchemy connection setup
│   ├── chat_history.py  # Database models
│   ├── temp/            # Local storage for uploaded PDFs (ignored)
│   └── vectors/         # Vector index storage (ignored)
├── frontend/
│   └── vite-project/    # React frontend application
└── .gitignore           # Global git ignore rules
Security Note
This project uses environment variables (.env) to manage sensitive API keys.
Ensure that your .env file is never committed to version control.
Refer to the .env.example for the required configuration.
