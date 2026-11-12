import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import type { PolicyEvaluation } from '../../types/index.ts';

interface PolicyEvaluationCardProps {
  evaluation: PolicyEvaluation;
  onReviewPurchase?: () => void;
  disabled?: boolean;
}

export const PolicyEvaluationCard: React.FC<PolicyEvaluationCardProps> = ({
  evaluation,
  onReviewPurchase,
  disabled = false,
}) => {
  const isBlocked = evaluation.status === 'BLOCKED';
  const isReview = evaluation.status === 'NEEDS_REVIEW';
  const isPass = evaluation.status === 'PASS';

  const badgeStyles = {
    PASS: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: ShieldCheck,
      iconColor: 'text-emerald-700',
      label: 'POLICY PASSED',
    },
    NEEDS_REVIEW: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
      label: 'NEEDS MANAGERIAL REVIEW',
    },
    BLOCKED: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      icon: ShieldAlert,
      iconColor: 'text-rose-700',
      label: 'PURCHASE BLOCKED',
    },
  }[evaluation.status];

  const Icon = badgeStyles.icon;

  return (
    <div className={`rounded-xl border ${badgeStyles.border} ${badgeStyles.bg} p-4 transition-all shadow-2xs`}>
      {/* Header status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${badgeStyles.iconColor}`} />
          <span className={`text-xs font-bold tracking-wide ${badgeStyles.text}`}>
            {badgeStyles.label}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 tabular-nums">
          Total: ${evaluation.cartTotal.toFixed(2)}
        </span>
      </div>

      {/* Summary message */}
      <p className="text-xs text-slate-800 font-medium mb-3 leading-relaxed">
        {evaluation.summary}
      </p>

      {/* Rule breakdown */}
      {evaluation.rules.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-200/60 pt-2.5 mb-3">
          {evaluation.rules.map((rule) => {
            const ruleIcon = rule.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : rule.severity === 'BLOCKING' ? (
              <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            );

            return (
              <div key={rule.ruleId} className="flex items-start gap-2 text-[11px]">
                {ruleIcon}
                <div className="flex-1">
                  <span className={`font-medium ${rule.passed ? 'text-slate-700' : rule.severity === 'BLOCKING' ? 'text-rose-900 font-semibold' : 'text-amber-900 font-semibold'}`}>
                    {rule.name}:
                  </span>{' '}
                  <span className="text-slate-600">{rule.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Action CTA */}
      {onReviewPurchase && (
        <div className="border-t border-slate-200/60 pt-3">
          <button
            onClick={onReviewPurchase}
            disabled={disabled || isBlocked}
            className={`w-full rounded-lg py-2 px-3 text-xs font-semibold shadow-xs transition-colors ${
              isBlocked
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isBlocked
              ? 'Checkout Blocked by Policy'
              : 'Review Purchase & Checkout Flow'}
          </button>
          {isBlocked && (
            <p className="text-[10px] text-center text-slate-500 mt-1.5">
              Remove non-compliant items or edit your spending mandate to proceed.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
