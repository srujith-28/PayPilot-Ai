import React from 'react';
import { Sparkles, ShieldCheck, Lock } from 'lucide-react';
import { AssistantChat } from '../components/assistant/AssistantChat.tsx';

export const AIAssistantPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            PayPilot AI Financial Copilot
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time advisory for invoices, procurement policy checks, and scenario stress-testing
          </p>
        </div>

        {/* Safety & Compliance Badge */}
        <div className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs text-teal-900 shadow-2xs">
          <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0" />
          <span>Deterministic Governance · Cannot Auto-Execute Payments</span>
        </div>
      </div>

      {/* Embedded Assistant Chat Interface */}
      <AssistantChat />
    </div>
  );
};
