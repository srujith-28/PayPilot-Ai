import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  CreditCard,
  Building,
  Bell,
  RotateCcw,
  Check,
  AlertCircle,
  ExternalLink,
  Activity,
  RefreshCw,
  Lock,
  Server,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

export const SettingsPage: React.FC = () => {
  const {
    user,
    setUser,
    mandate,
    updateMandate,
    minimumCashReserve,
    setMinimumCashReserve,
    resetAllDemoData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'mandate' | 'notifications' | 'integrations'>('mandate');
  const [saveToast, setSaveToast] = useState(false);

  // Form states for profile
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [companyName, setCompanyName] = useState(user.companyName);
  const [currency, setCurrency] = useState(user.currency);

  // Form states for mandate
  const [monthlyBudget, setMonthlyBudget] = useState(mandate.monthlyBudget);
  const [maxSingleItemLimit, setMaxSingleItemLimit] = useState(mandate.maxSingleItemLimit);
  const [allowedCategories, setAllowedCategories] = useState<string[]>(mandate.allowedCategories);

  const allAvailableCategories = [
    'Office Equipment',
    'Software & Tools',
    'Ergonomics',
    'Hardware',
    'Luxury Goods',
    'Entertainment',
    'Personal Apparel',
  ];

  // Notification state
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [notifyReserveBreach, setNotifyReserveBreach] = useState(true);
  const [notifyApprovals, setNotifyApprovals] = useState(true);

  // PayPal Diagnostics state
  const [paypalDiagnostic, setPaypalDiagnostic] = useState<any | null>(null);
  const [loadingPaypalDiag, setLoadingPaypalDiag] = useState(false);

  const fetchPaypalDiagnostics = async () => {
    setLoadingPaypalDiag(true);
    try {
      const res = await fetch('/api/paypal/diagnostic');
      const data = await res.json();
      setPaypalDiagnostic(data);
    } catch {
      setPaypalDiagnostic(null);
    } finally {
      setLoadingPaypalDiag(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'integrations') {
      fetchPaypalDiagnostics();
    }
  }, [activeTab]);

  const handleToggleCategory = (cat: string) => {
    setAllowedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSaveMandate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMandate({
      monthlyBudget,
      maxSingleItemLimit,
      allowedCategories,
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUser((prev) => ({
      ...prev,
      name,
      email,
      companyName,
      currency,
    }));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Settings & Governance Policies
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure business profiles, deterministic spending mandates, reserve thresholds, and integrations
          </p>
        </div>

        {saveToast && (
          <div className="flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-800 animate-fade-in">
            <Check className="h-4 w-4 text-teal-700" />
            <span>Settings updated successfully</span>
          </div>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-lg w-fit">
        {(
          [
            { id: 'mandate', label: 'Spending Mandate & Limits', icon: Shield },
            { id: 'profile', label: 'Business Profile', icon: Building },
            { id: 'integrations', label: 'Integrations & Payments', icon: CreditCard },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-slate-500" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Spending Mandate & Limits */}
      {activeTab === 'mandate' && (
        <form onSubmit={handleSaveMandate} className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-6 max-w-3xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Deterministic Spending Mandate</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These rules are enforced by hard code in the checkout engine. AI cannot bypass or override them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Monthly Budget */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Monthly Spending Budget (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-1.5 text-xs font-bold text-slate-900 tabular-nums focus:border-teal-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Total procurement cap allowed per calendar month.
              </p>
            </div>

            {/* Max Single-Item Limit */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Maximum Single-Item Unit Ceiling (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  min="50"
                  step="25"
                  value={maxSingleItemLimit}
                  onChange={(e) => setMaxSingleItemLimit(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-1.5 text-xs font-bold text-slate-900 tabular-nums focus:border-teal-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Any individual product exceeding this price is deterministically blocked.
              </p>
            </div>
          </div>

          {/* Minimum Reserve Threshold Slider */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Minimum Cash Reserve Floor</span>
              <span className="font-bold text-slate-900 tabular-nums">
                ${minimumCashReserve.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="2000"
              max="15000"
              step="500"
              value={minimumCashReserve}
              onChange={(e) => setMinimumCashReserve(parseInt(e.target.value, 10))}
              className="w-full accent-teal-700 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Purchases dropping liquidity below this floor trigger an immediate review status.
            </p>
          </div>

          {/* Allowed Categories Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Allowed Business Categories
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {allAvailableCategories.map((cat) => {
                const isChecked = allowedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-teal-200 bg-teal-50/40 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCategory(cat)}
                      className="accent-teal-700 rounded"
                    />
                    <span className="font-medium">{cat}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 shadow-xs"
            >
              Save Policy Mandate
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Business Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4 max-w-2xl text-xs">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Personal & Business Profile</h3>
              <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Sample Demo Persona</span>
            </div>
            <p className="text-slate-500 mt-1">
              Pre-seeded with demo identity (Jordan Miller / Miller Design Lab LLC). Customize with your own business name and contact information to personalize generated invoices, reminders, and purchase reviews.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Company / Studio Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Base Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:border-teal-500"
              >
                <option value="USD">USD ($) — United States Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 shadow-xs"
            >
              Update Profile
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Integrations & Payments */}
      {activeTab === 'integrations' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-6 max-w-2xl text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Payment Gateway Integrations</h3>
            <p className="text-slate-500 mt-0.5">
              Manage payment providers and sandbox execution endpoints.
            </p>
          </div>

          {/* PayPal Status Box with Live Sandbox Diagnostics */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-800 text-white font-bold text-sm shadow-xs">
                  PP
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-xs">PayPal Commerce Platform</h4>
                    <span className="rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5">
                      SANDBOX MODE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">api-m.sandbox.paypal.com · REST Checkout & Orders API</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${
                  paypalDiagnostic?.oauth?.authenticated
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {paypalDiagnostic?.oauth?.authenticated ? 'Sandbox Connected' : 'Unconfigured'}
                </span>
                <button
                  type="button"
                  onClick={fetchPaypalDiagnostics}
                  disabled={loadingPaypalDiag}
                  className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:text-slate-900 shadow-2xs"
                  title="Refresh Diagnostics"
                  aria-label="Refresh PayPal Sandbox diagnostics"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingPaypalDiag ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Prominent Sandbox Isolation Warning */}
            <div className="rounded-lg bg-teal-50 border border-teal-200 p-2.5 text-[11px] text-teal-950">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <ShieldAlert className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                <span>SANDBOX MODE · LIVE PAYMENTS STRICTLY PROHIBITED</span>
              </div>
              <p className="text-teal-800 text-[10px] leading-relaxed">
                PayPilot AI operates exclusively in PayPal Sandbox. Live PayPal URLs are rejected by server policy. Buyer authentication takes place directly on PayPal's secure sandbox login screen.
              </p>
            </div>

            {/* Diagnostic Indicators */}
            {paypalDiagnostic && (
              <div className="rounded-lg bg-white border border-teal-200/80 p-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-blue-700" />
                    <span>Sandbox Checkout Diagnostic Indicators</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">api-m.sandbox.paypal.com</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  <div className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">OAuth Authentication:</span>
                      <p className="text-[10px] text-slate-500">
                        {paypalDiagnostic.oauth?.authenticated ? 'Authenticated (Bearer token cached)' : 'Unauthenticated'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">Order Creation:</span>
                      <p className="text-[10px] text-slate-500">Authoritative catalog price recalculation</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">Approval URL:</span>
                      <p className="text-[10px] text-slate-500">sandbox.paypal.com/checkoutnow (Direct buyer login)</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">Capture Endpoint:</span>
                      <p className="text-[10px] text-slate-500">Pre-approval gated & idempotency protected</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stripe / Bank Transfer */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between opacity-60">
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Bank Wire / ACH Plaid Link</h4>
              <p className="text-[11px] text-slate-500">Direct business bank balance synchronization</p>
            </div>
            <span className="rounded bg-slate-200 text-slate-600 text-[11px] font-medium px-2 py-0.5">
              Disabled in Demo
            </span>
          </div>
        </div>
      )}

      {/* Tab 4: Notifications */}
      {activeTab === 'notifications' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4 max-w-2xl text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Financial Alerts & Notifications</h3>
            <p className="text-slate-500 mt-0.5">Configure automated copilot triggers and overdue reminders.</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={notifyOverdue}
                onChange={(e) => setNotifyOverdue(e.target.checked)}
                className="accent-teal-700 rounded mt-0.5"
              />
              <div>
                <p className="font-semibold text-slate-900">Overdue Invoice Auto-Drafts</p>
                <p className="text-slate-500 text-[11px]">
                  Automatically draft follow-up email notices when an invoice passes its due date.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={notifyReserveBreach}
                onChange={(e) => setNotifyReserveBreach(e.target.checked)}
                className="accent-teal-700 rounded mt-0.5"
              />
              <div>
                <p className="font-semibold text-slate-900">Cash Reserve Floor Advisory</p>
                <p className="text-slate-500 text-[11px]">
                  Warn when a proposed cart purchase or upcoming tax expense dips available cash below the ${minimumCashReserve.toLocaleString()} threshold.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={notifyApprovals}
                onChange={(e) => setNotifyApprovals(e.target.checked)}
                className="accent-teal-700 rounded mt-0.5"
              />
              <div>
                <p className="font-semibold text-slate-900">Pending Spending Approvals</p>
                <p className="text-slate-500 text-[11px]">
                  Highlight transactions awaiting explicit user sign-off in the header and sidebar badges.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Global Reset Demo Data Card */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 max-w-3xl space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-rose-700" />
          <h3 className="font-bold text-rose-900 text-sm">Reset Sample Environment</h3>
        </div>
        <p className="text-rose-800/80 leading-relaxed">
          Restore all sample clients, invoices, pending approvals, mandate configurations, and the starting $14,250.00 demo cash reserve to their original demonstration state.
        </p>
        <button
          type="button"
          onClick={resetAllDemoData}
          className="rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800 transition-colors shadow-2xs"
        >
          Reset All Demo Data
        </button>
      </div>
    </div>
  );
};
