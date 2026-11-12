import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, RotateCcw, ArrowRight, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { PageRoute } from '../../types/index.ts';

export const AssistantChat: React.FC = () => {
  const {
    assistantMessages,
    isAssistantLoading,
    sendAssistantMessage,
    resetAssistantChat,
    setCurrentRoute,
    setActiveModal,
  } = useApp();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    'Which invoices are overdue?',
    'Can I afford an $80 office supply purchase this week?',
    'Draft an invoice for my latest project.',
    'What happens to my cash reserve if two clients pay late?',
    'Explain why this shopping cart was blocked.',
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendAssistantMessage(input.trim());
    setInput('');
  };

  const handleActionClick = (route?: PageRoute) => {
    if (route) {
      setCurrentRoute(route);
      if (route === 'smart-invoice') {
        setActiveModal('CREATE_INVOICE');
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages]);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px] rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-800 text-white shadow-xs">
            <Sparkles className="h-4.5 w-4.5 text-teal-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">PayPilot Financial Copilot</h2>
            <p className="text-[11px] text-slate-500">
              Deterministic, policy-grounded answers based on your actual demo data
            </p>
          </div>
        </div>

        <button
          onClick={resetAssistantChat}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Reset conversation"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {assistantMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs leading-relaxed max-w-2xl ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-800 text-white font-bold text-[11px]">
                P
              </div>
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white font-semibold text-[11px]">
                JM
              </div>
            )}

            <div
              className={`rounded-2xl p-4 ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-xs'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Data Highlight card if attached */}
              {msg.dataHighlight && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-xs">{msg.dataHighlight.title}</span>
                    <span className="font-bold text-teal-800 tabular-nums">
                      {msg.dataHighlight.value}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{msg.dataHighlight.details}</p>
                </div>
              )}

              {/* Suggested action buttons */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200/60 pt-2.5">
                  {msg.suggestedActions.map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleActionClick(act.route)}
                      className="flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors"
                    >
                      <span>{act.label}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] mt-2 pt-1 border-t border-slate-200/40">
                <span className={msg.role === 'user' ? 'text-slate-400 text-right w-full' : 'text-slate-400'}>
                  {msg.timestamp}
                </span>
                {msg.role === 'assistant' && msg.modelUsed && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-200/60 px-1.5 py-0.5 text-[9px] font-mono text-slate-600">
                    <Sparkles className="h-2.5 w-2.5 text-teal-600" />
                    {msg.modelUsed}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isAssistantLoading && (
          <div className="flex gap-3 text-xs leading-relaxed max-w-2xl">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-800 text-white font-bold text-[11px] animate-pulse">
              P
            </div>
            <div className="rounded-2xl rounded-tl-xs p-4 bg-slate-50 border border-slate-200/80 text-slate-600">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] font-medium text-slate-500">
                  PayPilot AI is evaluating policy rules and generating response...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts strip */}
      <div className="border-t border-slate-100 bg-slate-50/50 p-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Try asking:</span>
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                sendAssistantMessage(q);
              }}
              className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <form onSubmit={handleSend} className="border-t border-slate-200 p-4 bg-white flex gap-2">
        <input
          type="text"
          placeholder="Ask PayPilot anything about your cashflow, invoices, or purchases..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          aria-label="Send message"
        >
          <span>Ask</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
