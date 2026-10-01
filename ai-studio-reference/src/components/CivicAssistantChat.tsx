import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  ExternalLink,
  MapPin,
  ShieldAlert,
  Loader2,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  sources?: { title: string; uri: string }[];
  mapsLinks?: { title: string; uri: string }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentJurisdictionName?: string;
}

export const CivicAssistantChat: React.FC<Props> = ({
  isOpen,
  onClose,
  currentJurisdictionName,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'model',
      content: `Hello! I am your **NaijaCivic Intelligence Advisor**.

I am grounded in official Nigerian civic data, the 1999 Constitution (774 Constitutional LGAs), State Government gazettes (e.g., Lagos State 20 LGAs + 37 LCDAs + 377 Wards), local DPO police commands, and public budget records.

How can I assist your civic engagement today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickPrompts = [
    'Explain Lagos 20 LGAs vs 37 LCDAs and 377 Wards',
    'Who is the DPO for Kosofe / Ogudu Division?',
    'Where is the Lagos State Police Command Headquarters?',
    'How do I report an emergency or ghost project?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/v1/civic-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          jurisdictionContext: currentJurisdictionName || 'Federal Republic of Nigeria',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      const modelMsg: ChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        content: data.reply || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: data.sources || [],
        mapsLinks: data.mapsLinks || [],
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        content: `Civic Advisory Notice:
Official verified context:
- Nigeria comprises 36 States + FCT and exactly 774 Constitutional LGAs.
- Lagos State operates 20 Constitutionally recognized LGAs (1999 Constitution) with 37 State-created LCDAs (total 57 local councils) and 377 electoral wards.
- For emergency life safety, dial 112 or 767.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs p-3 sm:p-6 transition-all">
      <div className="w-full max-w-xl h-[92vh] max-h-[750px] bg-white rounded-3xl border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <Sparkles className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Civic Intelligence Advisor
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Search & Maps Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Context:{' '}
                <strong className="text-slate-700">
                  {currentJurisdictionName || 'Federal Republic of Nigeria'}
                </strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                <div
                  className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed max-w-[90%] sm:max-w-[85%] shadow-xs ${
                    isUser
                      ? 'bg-emerald-700 text-white font-medium rounded-tr-xs'
                      : 'bg-white border border-slate-200/90 text-slate-900 rounded-tl-xs'
                  }`}
                >
                  {/* Clean Markdown-like Rendering */}
                  <div className="whitespace-pre-line space-y-2">
                    {m.content}
                  </div>

                  {/* Google Search Sources */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Verified Web Sources:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {m.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {s.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Google Maps Location Grounding */}
                  {m.mapsLinks && m.mapsLinks.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Google Maps Locations:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {m.mapsLinks.map((map, idx) => (
                          <a
                            key={idx}
                            href={map.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-sky-800 hover:text-sky-950 font-semibold bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 transition-colors"
                          >
                            <MapPin className="w-3 h-3 text-sky-600" />
                            {map.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <span
                    className={`text-[10px] mt-2 block text-right ${
                      isUser ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 max-w-[280px]">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              <span>Consulting verified civic records & maps...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions */}
        <div className="p-3 bg-white border-t border-slate-100 overflow-x-auto flex gap-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p)}
              disabled={isLoading}
              className="text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 whitespace-nowrap transition-all font-medium shrink-0"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-4 bg-white border-t border-slate-100 flex items-center gap-3"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about Lagos LGAs, DPO contacts, wards, or road budgets..."
            disabled={isLoading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="p-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl font-bold transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
