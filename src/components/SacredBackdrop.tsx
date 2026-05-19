import medievalBg from "@/assets/medieval-bg.jpg";
import sacredCross from "@/assets/sacred-cross.jpg";
import cathedralBg from "@/assets/cathedral-bg.jpg";

const VARIANTS = {
  medieval: medievalBg,
  cross: sacredCross,
  cathedral: cathedralBg,
} as const;

interface Props {
  variant?: keyof typeof VARIANTS;
  opacity?: number;
}

/** Decorative sacred backdrop, fixed behind page content. */
export function SacredBackdrop({ variant = "medieval", opacity = 0.12 }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img
        src={VARIANTS[variant]}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover animate-float"
        style={{ opacity, filter: "saturate(1.1)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/95" />
      <div className="absolute inset-0 ray-bg animate-ray-rotate opacity-20" />
    </div>
  );
}
