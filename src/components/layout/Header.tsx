import React from 'react';
import { Menu, Sparkles, Plus, ShoppingCart, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { PageRoute } from '../../types/index.ts';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

const routeTitles: Record<PageRoute, { title: string; category: string }> = {
  overview: { title: 'Financial Overview', category: 'Dashboard' },
  'smart-spend': { title: 'Smart Spend & Procurement', category: 'Shopping' },
  'smart-invoice': { title: 'Smart Invoices & Receivables', category: 'Invoicing' },
  'cashflow-forecast': { title: 'Cashflow Forecast & Affordability', category: 'Planning' },
  'ai-assistant': { title: 'Financial AI Copilot', category: 'Assistant' },
  'activity-approvals': { title: 'Activity & Approvals Audit', category: 'Governance' },
  settings: { title: 'Settings & Policy Mandate', category: 'Configuration' },
};

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { currentRoute, setCurrentRoute, availableDemoCash, cart, setActiveModal } = useApp();
  const current = routeTitles[currentRoute] || { title: 'Overview', category: 'Dashboard' };
  const cartTotalCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      {/* Left: Mobile hamburger + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{current.category}</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <h1 className="font-semibold text-slate-900 text-sm">{current.title}</h1>
        </div>
      </div>

      {/* Right: Balance indicator & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Available Demo Cash Indicator */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-1.5">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Demo Cash:</span>
          <span className="text-xs font-bold text-slate-900 tabular-nums">
            ${availableDemoCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="rounded bg-teal-100 text-teal-800 text-[10px] font-semibold px-1 py-0.2">
            Simulated
          </span>
        </div>

        {/* Quick Cart Trigger */}
        <button
          onClick={() => setCurrentRoute('smart-spend')}
          className="relative flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          aria-label="Shopping Cart"
        >
          <ShoppingCart className="h-4 w-4" />
          {cartTotalCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-800 px-1 text-[10px] font-bold text-white tabular-nums">
              {cartTotalCount}
            </span>
          )}
        </button>

        {/* Context-aware Quick Action Button */}
        {currentRoute === 'smart-invoice' ? (
          <button
            onClick={() => setActiveModal('CREATE_INVOICE')}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Invoice</span>
          </button>
        ) : (
          <button
            onClick={() => setCurrentRoute('ai-assistant')}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-300" />
            <span>Ask Copilot</span>
          </button>
        )}
      </div>
    </header>
  );
};
