import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const baseUrl = "https://single-document-chatbot-backend.onrender.com";

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const completeResponseRef = useRef('');

  // Load chat history when conversation_id is present
  useEffect(() => {
    const conversationId = searchParams.get('conversation_id');
    if (conversationId) {
      fetchChatHistory(conversationId);
    }
  }, [searchParams]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentResponse]);

  const fetchChatHistory = async (conversationId: string) => {
    try {
      const response = await fetch(`${baseUrl}/chat/${conversationId}`);
      const data = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setSearchParams({ conversation_id: data.conversation_id });
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const conversationId = searchParams.get('conversation_id');
    if (!conversationId) {
      alert('Please upload a PDF first');
      return;
    }

    // Add user message immediately
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setCurrentResponse('');
    completeResponseRef.current = '';

    try {
      const response = await fetch(`${baseUrl}/chat_stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_message: input
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        setCurrentResponse(prev => prev + text);
        completeResponseRef.current += text;
      }

      // Add complete message and clear current response
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: completeResponseRef.current 
      }]);
      setCurrentResponse('');

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-container">
      {!searchParams.get('conversation_id') ? (
        <div className="upload-section">
          <h2>Upload a PDF to start chatting</h2>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          {isUploading && <p>Uploading...</p>}
        </div>
      ) : (
        <>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ))}
            {currentResponse && (
              <div className="message assistant">
                <ReactMarkdown>{currentResponse}</ReactMarkdown>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
            />
            <button type="submit">Send</button>
          </form>
          <div className="feedback-message">
          This simple user interface is meant for testing an LLM's ability to answer users' questions on an uploaded document. Chat history is automatically saved. Please send any feedback to thuan.nguyen208@gatech.edu and copy the URL.
          </div>
        </>
      )}
    </div>
  );
}

export default App;
