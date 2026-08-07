import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";
import { CosmosIAlphaFundo } from "../CosmosIAlphaFundo";
import { RadarFundo } from "../RadarFundo";
import { EstelarFundo } from "../EstelarFundo";
import { BlueprintFundo } from "../BlueprintFundo";

/**
 * Dispatcher da categoria "Backgrounds" — despacha por `componente.estilo` para a engine
 * correspondente. "estelar" é uma única engine compartilhada entre os 3 presets (CS&NPS/
 * CheckList/Agenda Alpha), ver EstelarFundo.tsx e registry-fundos.ts.
 */
export function RenderFundoAnimado({ componente }: { componente: FundoAnimadoComponente }) {
  switch (componente.estilo) {
    case "cosmosIAlpha":
      return <CosmosIAlphaFundo componente={componente} />;
    case "radar":
      return <RadarFundo componente={componente} />;
    case "estelar":
      return <EstelarFundo componente={componente} />;
    case "blueprintTecnico":
      return <BlueprintFundo componente={componente} />;
    case "auroraModulos":
      return (
        <AnimatedShaderBackground
          className="absolute inset-0 overflow-hidden pointer-events-none"
          corPrimaria={componente.corPrimaria}
          corSecundaria={componente.corSecundaria}
          velocidade={componente.velocidade}
          intensidade={componente.intensidade}
        />
      );
    default:
      return null;
  }
}
