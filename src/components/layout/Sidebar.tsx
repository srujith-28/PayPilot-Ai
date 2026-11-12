import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Sparkles,
  CheckSquare,
  Settings,
  RotateCcw,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { PageRoute } from '../../types/index.ts';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const {
    currentRoute,
    setCurrentRoute,
    cart,
    invoices,
    approvals,
    user,
    resetAllDemoData,
  } = useApp();

  const overdueInvoicesCount = invoices.filter((i) => i.status === 'overdue').length;
  const pendingApprovalsCount = approvals.filter((a) => a.state === 'AWAITING_APPROVAL').length;
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const navItems: { id: PageRoute; label: string; icon: React.ElementType; badge?: number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'smart-spend', label: 'Smart Spend', icon: ShoppingCart, badge: cartItemCount > 0 ? cartItemCount : undefined, badgeColor: 'bg-teal-700 text-white' },
    { id: 'smart-invoice', label: 'Smart Invoice', icon: Receipt, badge: overdueInvoicesCount > 0 ? overdueInvoicesCount : undefined, badgeColor: 'bg-rose-600 text-white' },
    { id: 'cashflow-forecast', label: 'Cashflow Forecast', icon: TrendingUp },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'activity-approvals', label: 'Activity & Approvals', icon: CheckSquare, badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined, badgeColor: 'bg-amber-600 text-white' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (route: PageRoute) => {
    setCurrentRoute(route);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-68 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white shadow-xs">
              <span className="font-bold tracking-tight text-base">P</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-base">PayPilot</span>
                <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">AI</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">Intelligent Copilot</p>
            </div>
          </div>
        </div>

        {/* Persistent DEMO Environment Indicator */}
        <div className="mx-4 my-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-800 shrink-0" />
            <span className="text-xs font-semibold text-amber-900">DEMO MODE ACTIVE</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800/90 leading-tight">
            Simulated environment. No live bank or PayPal transactions.
          </p>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                      isActive ? 'text-teal-300' : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums shrink-0 ${
                      item.badgeColor || 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Reset Data */}
        <div className="border-t border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
              onError={(e) => {
                // Resilient fallback if local image has issues
                (e.currentTarget as HTMLImageElement).src =
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect width="36" height="36" fill="%230f766e"/><text x="18" y="23" font-size="14" font-weight="bold" fill="white" text-anchor="middle">JM</text></svg>';
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">{user.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user.companyName}</p>
            </div>
          </div>

          <button
            onClick={resetAllDemoData}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Reset sample clients, invoices, and cash balance to original state"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </aside>
    </>
  );
};
