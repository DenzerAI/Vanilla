import { LucideRotateCcw as RotateCcw, LucideZap as Zap } from "../../icon-variants.jsx";
import { GlassButton } from "@/components/ui/glass-button";

export default function GlassButtonDemo() {
  return <div className="glass-button-demo" aria-label="Glasbuttons · Designvorschau">
    <GlassButton size="sm">Klein</GlassButton>
    <GlassButton><RotateCcw size={16} aria-hidden="true" />Neustarten</GlassButton>
    <GlassButton size="lg">Aktualisieren</GlassButton>
    <GlassButton size="icon" aria-label="Generieren · Beispiel"><Zap size={20} aria-hidden="true" /></GlassButton>
    <GlassButton size="sm" disabled>Deaktiviert</GlassButton>
  </div>;
}
