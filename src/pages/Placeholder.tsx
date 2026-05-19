import { Construction } from "lucide-react";

export default function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>
      <div className="glass rounded-3xl p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-divine mx-auto flex items-center justify-center shadow-glow animate-float">
          <Construction className="w-8 h-8 text-primary-foreground" />
        </div>
        <p className="font-display text-xl">Prochainement</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Cette section sera disponible dans la prochaine itération. Les fondations sont posées —
          rappels avancés, statistiques dynamiques et paramètres complets arrivent bientôt.
        </p>
      </div>
    </div>
  );
}
