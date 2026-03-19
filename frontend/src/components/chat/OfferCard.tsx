import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import type { LoanOffer } from "@/types/chat";
import type { TrackingParams } from "@/lib/tracking";
import { appendTrackingParams } from "@/lib/tracking";

interface OfferCardProps {
  offer: LoanOffer;
  trackingParams?: TrackingParams;
  flat?: boolean;
}

export function OfferCard({ offer, trackingParams = {}, flat = false }: OfferCardProps) {
  const finalApplyUrl = useMemo(
    () => appendTrackingParams(offer.applyUrl, trackingParams),
    [offer.applyUrl, trackingParams],
  );

  return (
    <div className={flat ? "py-2.5" : "rounded-xl border border-border bg-chat-ai-bg px-4 py-3 my-1"}>
      {/* Brand + badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-semibold text-sm text-foreground">{offer.brand}</span>
        {offer.badgeLabel && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            offer.isBest
              ? "bg-offer-badge/15 text-offer-badge border-offer-badge/30"
              : "bg-primary/10 text-primary border-primary/25"
          }`}>
            {offer.badgeLabel}
          </span>
        )}
      </div>

      {/* Link */}
      <div className="flex items-start gap-1.5 text-sm mb-1.5">
        <span className="text-muted-foreground shrink-0">• Link:</span>
        <a
          href={finalApplyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80 active:opacity-60 transition-opacity break-all inline-flex items-center gap-1"
        >
          {offer.applyUrl.replace(/^https?:\/\//, "").split("/")[0]}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>

      {/* Reason */}
      <div className="flex items-start gap-1.5 text-sm">
        <span className="text-muted-foreground shrink-0">• Phù hợp vì:</span>
        <span className="text-foreground/85 leading-snug">{offer.tagline}</span>
      </div>
    </div>
  );
}
