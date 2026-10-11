import React, { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../services/api';
import { Sparkles, Send, Loader2, Bot, User } from 'lucide-react';

export default function TutorChat({ errorContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleOpen = async () => {
    setIsOpen(true);
    if (messages.length === 0 && !isTyping) {
      await initializeChat();
    }
  };

  const initializeChat = async () => {
    setIsTyping(true);
    try {
      // Create conversation
      const convData = await fetchApi('/tutor/conversations', {
        method: 'POST',
        body: JSON.stringify({
          attempt_id: errorContext.attempt_id,
          question_id: errorContext.question_id
        })
      });
      
      setConversationId(convData.id);

      // Trigger initial AI explanation
      const response = await fetchApi(`/tutor/conversations/${convData.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: 'Can you explain this question and my answer?',
          history: [],
          question_text: errorContext.question_text,
          answer_options: [], // Optional, passed as empty for simplicity or fetch full
          user_selected_answer: errorContext.selected_option_text,
          verified_correct_answer: errorContext.correct_option_text,
          source_explanation: errorContext.original_explanation
        })
      });
      
      setMessages([response]); // Only show assistant response initially
    } catch (err) {
      setMessages([{ role: 'assistant', content: 'Sorry, I am currently unavailable. ' + err.message }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !conversationId || isTyping) return;
    
    const userMsg = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    
    try {
      const response = await fetchApi(`/tutor/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: userMsg.content,
          history: messages,
          question_text: errorContext.question_text,
          user_selected_answer: errorContext.selected_option_text,
          verified_correct_answer: errorContext.correct_option_text,
          source_explanation: errorContext.original_explanation
        })
      });
      setMessages(prev => [...prev, response]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred: ' + err.message }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={handleOpen}
        className="mt-4 flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-sm font-medium transition-colors border border-indigo-200"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Ask AI Tutor to Explain
      </button>
    );
  }

  return (
    <div className="mt-4 border border-indigo-100 rounded-xl overflow-hidden flex flex-col bg-slate-50">
      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center text-indigo-900 font-medium">
          <Bot className="h-5 w-5 mr-2 text-indigo-600" />
          QuizForge AI Tutor
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">
          Close
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto max-h-80 space-y-4 text-sm">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 rounded-full p-1.5 ${msg.role === 'user' ? 'bg-indigo-100 ml-3' : 'bg-white border border-slate-200 mr-3'}`}>
                {msg.role === 'user' ? <User className="h-4 w-4 text-indigo-700" /> : <Sparkles className="h-4 w-4 text-indigo-600" />}
              </div>
              <div className={`px-4 py-2.5 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'}`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start max-w-[85%]">
              <div className="shrink-0 rounded-full p-1.5 bg-white border border-slate-200 mr-3">
                <Sparkles className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-tl-sm flex items-center shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> AI is thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 bg-white border-t border-slate-200 flex">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a follow-up question..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button 
          onClick={handleSend}
          disabled={isTyping || !inputValue.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-r-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
