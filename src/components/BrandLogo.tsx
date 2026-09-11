import { CASEX_LOGO_DATA_URI } from "@/assets/casex-logo";

export function BrandLogo({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src={CASEX_LOGO_DATA_URI}
      alt="CaseX logo"
      className={`${className} shrink-0 object-contain`}
    />
  );
}