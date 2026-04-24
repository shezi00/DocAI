import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [stage, setStage] = useState('upload'); 
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [sessions, setSessions] = useState([]); // List of past PDFs from DB
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const chatEndRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  // 1. Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // 2. Fetch sessions on initial load
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get("http://localhost:8000/sessions");
      setSessions(res.data);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  // 3. Load an existing session from sidebar
  const loadSession = async (session) => {
    try {
      const res = await axios.get(`http://localhost:8000/history/${session.id}`);
      setChat(res.data);
      setCurrentSessionId(session.id);
      setFile({ name: session.filename }); // Update label
      setStage('chat');
    } catch (err) {
      alert("Error loading history");
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // 4. Handle New Upload
  const startProcessing = async () => {
    if (!file) return;
    setStage('processing');
    const formData = new FormData();
    formData.append("file", file);

    try {
      const interval = setInterval(() => {
        setProgress((prev) => (prev < 95 ? prev + 5 : prev));
      }, 800);

      const res = await axios.post("http://localhost:8000/upload", formData);
      
      clearInterval(interval);
      setProgress(100);
      setCurrentSessionId(res.data.session_id); // Save current ID
      fetchSessions(); // Refresh history list
      
      setTimeout(() => setStage('chat'), 500);
    } catch (err) {
      alert("Error processing PDF");
      setStage('upload');
      setProgress(0);
    }
  };
const handleDeleteClick = (e, id) => {
  e.stopPropagation(); 
  setSessionToDelete(id); 
  setShowDeleteModal(true); 
  // DO NOT add axios or setStage here.
};
const confirmDelete = async () => {
  if (!sessionToDelete) return;

  try {
    await axios.delete(`http://localhost:8000/session/${sessionToDelete}`);
    
    // ONLY redirect if the user was currently chatting with the deleted file
    if (currentSessionId === sessionToDelete) {
      setStage('upload');
      setChat([]);
      setFile(null);
      setCurrentSessionId(null);
    }
    
    // Refresh the list and close the modal
    fetchSessions();
    setShowDeleteModal(false);
    setSessionToDelete(null);
  } catch (err) {
    alert("Failed to delete session");
  }
};
  // 5. Ask Question to specific session
  const handleAsk = async () => {
    if (!question || !currentSessionId) return;
    const userMsg = { role: 'user', text: question };
    setChat(prev => [...prev, userMsg]);
    setQuestion("");
    
    try {
      const res = await axios.post(`http://localhost:8000/ask/${currentSessionId}`, { question });
      setChat(prev => [...prev, { role: 'bot', text: res.data.answer }]);
    } catch (err) {
      setChat(prev => [...prev, { role: 'bot', text: "Server error. Try again." }]);
    }
  };

  // --- STAGE 1: UPLOAD SCREEN ---
  if (stage === 'upload') {
    return (
      <div className="full-screen-center">
        <div className="upload-card">
          <img src="/robot.png" alt="Logo" className="custom-icon" />
          <h1>DocAI</h1>
          <p>Analyze your PDF with Gemini. Your history is automatically saved.</p>
          
          <input type="file" id="file-hidden" accept=".pdf" onChange={handleFileChange} />
          <label htmlFor="file-hidden" className="file-label">
            {file ? file.name : "Choose a File"}
          </label>
          <button className="start-btn" onClick={startProcessing} disabled={!file}>
            Analyze Document
          </button>

          {sessions.length > 0 && (
            <div className="recent-previews">
              <span className="small-label">OR RESUME RECENT:</span>
              <div className="preview-list">
                {sessions.slice(0, 2).map(s => (
                  <div key={s.id} className="preview-item" onClick={() => loadSession(s)}>
                    📄 {s.filename}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- STAGE 2: PROCESSING SCREEN ---
  if (stage === 'processing') {
    return (
      <div className="full-screen-center">
        <div className="processing-card">
          <div className="spinner"></div>
          <h2>Creating Memory...</h2>
          <p>DocAI is reading, chunking, and embedding your PDF.</p>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="percent">{progress}%</span>
        </div>
      </div>
    );
  }

  // --- STAGE 3: CHAT SCREEN (With Sidebar) ---
  return (
    <div className="chat-layout">
      {/* SIDEBAR */}
      <aside className="chat-sidebar">
  <div className="sidebar-header">History</div>
  <div className="session-list">
    {sessions.map(s => (
      <div 
        key={s.id} 
        className={`session-item ${currentSessionId === s.id ? 'active' : ''}`}
        onClick={() => loadSession(s)}
      >
        <span className="name">📄 {s.filename}</span>
        {/* New Delete Button */}
        <button className="delete-session-btn" onClick={(e) => handleDeleteClick(e, s.id)}> &times;</button>
      </div>
    ))}
  </div>
  <button className="new-chat-btn" onClick={() => setStage('upload')}>+ New PDF</button>
</aside>

      {/* MAIN CHAT AREA */}
      <main className="chat-interface">
        <header className="chat-nav">
          <div className="nav-logo"><b>DocAI</b></div>
          <div className="file-tag">Active: {file?.name}</div>
         
        </header>
        
        <div className="chat-body">
          {chat.length === 0 && (
            <div className="empty-chat">
              <p>Hello! Ask me anything about <b>{file?.name}</b></p>
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`chat-row ${msg.role}`}>
              <div className="chat-bubble">{msg.text}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="input-box">
            <input 
              type="text" 
              placeholder="Ask a question..." 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
            />
            <button onClick={handleAsk}>Send</button>
          </div>
        </div>
      </main>
      {showDeleteModal && (
  <div className="modal-overlay">
    <div className="modal-card">
      <div className="modal-icon">⚠️</div>
      <h2>Delete Document?</h2>
      <p>This will permanently remove the document and all associated chat history. This action cannot be undone.</p>
      <div className="modal-actions">
        <button className="cancel-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
        <button className="confirm-delete-btn" onClick={confirmDelete}>Delete Permanently</button>
      </div>
    </div>
  </div>
)}
    </div>
    
  );
}

export default App;