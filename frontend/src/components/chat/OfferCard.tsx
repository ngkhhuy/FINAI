import { ExternalLink, ChevronDown, ChevronUp, Zap, AlertCircle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import type { LoanOffer } from "@/types/chat";
import type { TrackingParams } from "@/lib/tracking";
import { appendTrackingParams } from "@/lib/tracking";
import { useLanguage } from "@/hooks/use-language";

interface OfferCardProps {
  offer: LoanOffer;
  trackingParams?: TrackingParams;
}

export function OfferCard({ offer, trackingParams = {} }: OfferCardProps) {
  const [showConditions, setShowConditions] = useState(false);
  const { t } = useLanguage();

  // Append affiliate tracking params to apply URL (memoised — only recalculates when URL or params change)
  const finalApplyUrl = useMemo(
    () => appendTrackingParams(offer.applyUrl, trackingParams),
    [offer.applyUrl, trackingParams],
  );

  return (
    <div className="rounded-xl border border-offer-border bg-gradient-card shadow-offer overflow-hidden my-2">
      {/* Card header stripe */}
      <div className="h-1.5 w-full gradient-hero" />

      <div className="p-4">
        {/* Brand row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-sm text-foreground truncate">
                {offer.brand}
              </span>
              {offer.badgeLabel && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  offer.isBest
                    ? "bg-offer-badge/15 text-offer-badge border-offer-badge/30"
                    : "bg-primary/10 text-primary border-primary/25"
                }`}>
                  {offer.badgeLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{offer.campaign}</p>
          </div>
          <a
            href={finalApplyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold gradient-hero text-primary-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            {t.offerCard.applyButton}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Why suitable */}
        <p className="text-sm text-foreground/80 mb-3 italic leading-relaxed">
          ✦ {offer.tagline}
        </p>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-4">
          <MetricPill label={t.offerCard.labelAmount} value={offer.amountRange} />
          <MetricPill label={t.offerCard.labelTerm} value={offer.termRange} />
          <MetricPill label={t.offerCard.labelAPR} value={offer.aprRange} highlight />
          <MetricPill
            label={t.offerCard.labelSpeed}
            value={offer.processingSpeed}
            icon={<Zap className="w-3 h-3" />}
          />
        </div>

        {/* APR Disclaimer */}
        <div className="flex items-start gap-1.5 rounded-lg bg-primary-subtle border border-primary/15 px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary/80 leading-relaxed">
            <strong>{t.offerCard.aprDisclaimerBold}</strong>{t.offerCard.aprDisclaimerRest}
          </p>
        </div>

        {/* Common requirements (collapsible) */}
        <button
          onClick={() => setShowConditions((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">
            {t.offerCard.commonRequirementsLabel} {offer.commonRequirements}
          </span>
          {showConditions ? (
            <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          )}
        </button>

        {showConditions && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted rounded-lg p-3 leading-relaxed">
            {offer.commonRequirements}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-2 flex flex-col gap-0.5 ${
        highlight
          ? "bg-primary-subtle border border-primary/20"
          : "bg-muted border border-border"
      }`}
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-xs font-semibold flex items-center gap-1 ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
