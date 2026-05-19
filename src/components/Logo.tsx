import logo from "@/assets/logo-rachetes.png";

interface Props {
  className?: string;
  size?: number;
  glow?: boolean;
}

export function Logo({ className = "", size = 64, glow = true }: Props) {
  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-70"
          style={{ background: "radial-gradient(circle, hsl(22 95% 58% / 0.6), transparent 70%)" }}
        />
      )}
      <img
        src={logo}
        alt="Les Rachetés du Père"
        width={size}
        height={size}
        className="relative rounded-full object-cover w-full h-full"
      />
    </div>
  );
}
