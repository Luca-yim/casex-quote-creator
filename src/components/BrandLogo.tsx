import logoAsset from "@/assets/casex-logo.png.asset.json";

export function BrandLogo({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="CaseX logo"
      className={`${className} shrink-0 object-contain`}
    />
  );
}