import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  ShoppingCart,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ProductCard } from '../components/spend/ProductCard.tsx';
import { PolicyEvaluationCard } from '../components/spend/PolicyEvaluationCard.tsx';
import { parseNaturalSpendSearch } from '../utils/rules.ts';
import type { Product } from '../types/index.ts';

export const SmartSpendPage: React.FC = () => {
  const {
    products,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    policyEvaluation,
    mandate,
    availableDemoCash,
    minimumCashReserve,
    setActiveModal,
    proposeCartPurchase,
    setCheckoutApproval,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | undefined>(undefined);
  const [aiSearchFeedback, setAiSearchFeedback] = useState<string | null>(null);

  const categories = ['All', 'Ergonomics', 'Hardware', 'Office Equipment', 'Luxury Goods'];

  // Handle Natural Language search query
  const handleNaturalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const parsed = parseNaturalSpendSearch(searchQuery);
    if (parsed.categoryHint) {
      setSelectedCategory(parsed.categoryHint);
    }
    if (parsed.maxPrice) {
      setMaxPriceFilter(parsed.maxPrice);
    }

    setAiSearchFeedback(
      `Filtered by: "${parsed.keyword}" ${parsed.categoryHint ? `in ${parsed.categoryHint}` : ''} ${
        parsed.maxPrice ? `(under $${parsed.maxPrice})` : ''
      }`
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setMaxPriceFilter(undefined);
    setAiSearchFeedback(null);
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
    if (maxPriceFilter !== undefined && p.price > maxPriceFilter) return false;
    if (searchQuery.trim()) {
      const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const textToSearch = `${p.name} ${p.description} ${p.category} ${p.vendor}`.toLowerCase();
      const matches = words.some((w) => textToSearch.includes(w));
      if (!matches) return false;
    }
    return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleOpenReview = () => {
    setActiveModal('PURCHASE_REVIEW');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Smart Spend & Policy Mandate
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-assisted product curation coupled with deterministic corporate spending compliance
          </p>
        </div>

        {/* Mandate Budget quick pill */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
          <span className="text-slate-500">Monthly Budget:</span>
          <span className="font-bold text-slate-900 tabular-nums">
            ${mandate.monthlyBudget.toFixed(2)}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">Spent:</span>
          <span className="font-semibold text-slate-800 tabular-nums">
            ${mandate.currentSpentThisMonth.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Natural Language Shopping Search Input */}
      <div className="rounded-2xl border border-teal-200/80 bg-white p-4 shadow-2xs space-y-2">
        <form onSubmit={handleNaturalSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3.5 top-2.5 h-4 w-4 text-teal-600" />
            <input
              type="text"
              placeholder="e.g. Find an ergonomic office chair under $150 or search mechanical keyboard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs whitespace-nowrap"
            >
              Search Catalog
            </button>
            {(searchQuery || selectedCategory !== 'All' || maxPriceFilter !== undefined) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Quick prompt suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1">
          <span className="text-slate-400">Try prompts:</span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('Find an ergonomic office chair under $250');
              setSelectedCategory('Ergonomics');
              setMaxPriceFilter(250);
            }}
            className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-slate-700 transition-colors"
          >
            "Ergonomic chair under $250"
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('Wireless mechanical keyboard');
              setSelectedCategory('Hardware');
              setMaxPriceFilter(undefined);
            }}
            className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-slate-700 transition-colors"
          >
            "Wireless mechanical keyboard"
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('Designer Italian Leather Briefcase');
              setSelectedCategory('Luxury Goods');
              setMaxPriceFilter(undefined);
            }}
            className="rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 px-2 py-0.5 transition-colors"
          >
            "Test Policy Block (Luxury Briefcase)"
          </button>
        </div>

        {aiSearchFeedback && (
          <p className="text-[11px] text-teal-800 font-medium pt-1">
            {aiSearchFeedback}
          </p>
        )}
      </div>

      {/* Main 2-Column Split: Products Catalog vs. Cart & Policy Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Category Filter Bar & Products Grid (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-lg">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.length === 0 ? (
              <div className="col-span-2 py-16 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="font-semibold text-slate-700 text-sm">No matching products found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try clearing your search query or price constraints.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const inCart = cart.some((i) => i.product.id === product.id);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    isInCart={inCart}
                    maxSingleItemLimit={mandate.maxSingleItemLimit}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Spending Mandate Rules & Live Cart Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">
          {/* Active Spending Mandate Rules Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900">Active Spending Mandate</span>
              <span className="text-[10px] text-slate-400 font-mono">
                Exp: {mandate.expirationDate}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Per-Item Limit:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ${mandate.maxSingleItemLimit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly Budget:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ${mandate.monthlyBudget.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Spent This Month:</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  ${mandate.currentSpentThisMonth.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-teal-800 font-medium">
                <span>Remaining Cap:</span>
                <span className="font-bold tabular-nums">
                  ${Math.max(0, mandate.monthlyBudget - mandate.currentSpentThisMonth).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Authorized Categories
              </span>
              <p className="text-[11px] text-slate-600 leading-snug">
                {mandate.allowedCategories.join(', ')}
              </p>
            </div>
          </div>

          {/* Cart & Policy Evaluation Container */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-slate-700" />
                <span className="font-bold text-slate-900 text-xs">
                  Shopping Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <ShoppingCart className="mx-auto h-8 w-8 text-slate-300 mb-2 stroke-1" />
                <p>Your shopping cart is empty.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Add to Cart" on any product to evaluate against spending policy.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Cart items list */}
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-2.5 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-semibold text-slate-900 truncate">
                            {item.product.name}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {item.product.category} · ${item.product.price.toFixed(2)}/unit
                          </span>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">
                          ${(item.quantity * item.product.price).toFixed(2)}
                        </span>
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center justify-between mt-1 pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="rounded border border-slate-200 p-0.5 text-slate-600 hover:bg-slate-100"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-semibold text-slate-800 tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="rounded border border-slate-200 p-0.5 text-slate-600 hover:bg-slate-100"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Live Evaluation */}
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">Cart Total:</span>
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      ${cartTotal.toFixed(2)} USD
                    </span>
                  </div>

                  {/* Policy Evaluation Component */}
                  <PolicyEvaluationCard
                    evaluation={policyEvaluation}
                    onReviewPurchase={handleOpenReview}
                    disabled={cart.length === 0}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
