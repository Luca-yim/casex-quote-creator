import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TOOLTIP_TEXT =
  "This quote was submitted by an external user via the self-serve request form.";

type Props = {
  /** `compact` for table rows, `full` for detail headers. */
  variant?: "compact" | "full";
  showTooltip?: boolean;
  className?: string;
};

/**
 * Marks a quote as coming from an external (self-serve) requester.
 *
 * Uses an outline badge in a distinct indigo tone so it never reads as a
 * workflow-state badge.
 */
export function ExternalBadge({
  variant = "compact",
  showTooltip = true,
  className,
}: Props) {
  const badge = (
    <Badge
      variant="outline"
      aria-label="External request"
      className={cn(
        "gap-1 border-indigo-300 bg-indigo-50 font-medium text-indigo-700",
        variant === "compact"
          ? "px-1.5 py-0 text-[10px] leading-4"
          : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      <UserPlus
        className={variant === "compact" ? "size-3" : "size-3.5"}
        aria-hidden="true"
      />
      {variant === "compact" ? "Ext" : "External request"}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{TOOLTIP_TEXT}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
