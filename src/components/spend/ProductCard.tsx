import React from 'react';
import { Star, Plus, Check, AlertCircle } from 'lucide-react';
import type { Product } from '../../types/index.ts';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  isInCart: boolean;
  maxSingleItemLimit: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  isInCart,
  maxSingleItemLimit,
}) => {
  const isOverItemLimit = product.price > maxSingleItemLimit;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
      <div>
        {/* Product Image with Resilient Fallback */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-slate-100 mb-3 border border-slate-100">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-102"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
              <span className="text-xs font-semibold text-slate-700">{product.name}</span>
              <span className="mt-1 text-[11px] text-slate-400">{product.category}</span>
            </div>
          )}

          {isOverItemLimit && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-rose-900/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs backdrop-blur-xs">
              <AlertCircle className="h-3 w-3" />
              <span>Over ${maxSingleItemLimit} Limit</span>
            </div>
          )}
        </div>

        {/* Category & Rating */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium text-slate-600">{product.category}</span>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium text-slate-700 tabular-nums">{product.rating}</span>
            <span className="text-slate-400 text-[11px]">({product.reviewsCount})</span>
          </div>
        </div>

        {/* Product Title */}
        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-1 mb-1">
          {product.name}
        </h3>

        {/* Vendor */}
        <p className="text-[11px] text-slate-400 mb-2">by {product.vendor}</p>

        {/* Description */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
          {product.description}
        </p>

        {/* Policy Comparison Notes */}
        <div className="rounded-md bg-slate-50 border border-slate-100 p-2 text-[11px] text-slate-600 mb-3">
          <span className="font-semibold text-slate-700">Mandate Note: </span>
          {product.comparisonNotes}
        </div>
      </div>

      {/* Footer: Price & Add to Cart button */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
        <div>
          <span className="text-[11px] text-slate-400 block">Unit Price</span>
          <span className="text-base font-bold text-slate-900 tabular-nums">
            ${product.price.toFixed(2)}
          </span>
        </div>

        <button
          onClick={() => onAddToCart(product)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            isInCart
              ? 'bg-teal-50 border border-teal-200 text-teal-800'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs'
          }`}
          aria-label={`Add ${product.name} to cart`}
        >
          {isInCart ? (
            <>
              <Check className="h-3.5 w-3.5 text-teal-600" />
              <span>In Cart</span>
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
