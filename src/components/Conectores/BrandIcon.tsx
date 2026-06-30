"use client";

import {
  siAirtable, siAsana, siBitbucket, siBookstack, siClickup, siCloudflare,
  siCoda, siConfluence, siDiscord, siDiscourse, siDropbox, siDrupal,
  siEgnyte, siGitbook, siGithub, siGitlab, siGmail, siGooglecloud,
  siGoogledrive, siHubspot, siJira, siLinear, siNotion, siOutline,
  siQnap, siTestrail, siWikipedia, siZendesk, siZulip,
  type SimpleIcon,
} from "simple-icons";
import {
  FileUp, Globe, Server, HardDrive, Mail, Cloud, Building2, MessagesSquare,
  Hash, MessageCircle, MessageSquare, BookText, BookOpen, Library, FileText,
  Lightbulb, GitBranch, Github, SquareKanban, LifeBuoy, Contact, Phone, Table,
  CircleCheck, LayoutDashboard, Database, Box, Mic, Presentation, ClipboardCheck,
  Webhook, Cable, type LucideIcon,
} from "lucide-react";

/** Mapa de slugs do simple-icons usados no catálogo. */
const BRANDS: Record<string, SimpleIcon> = {
  siAirtable, siAsana, siBitbucket, siBookstack, siClickup, siCloudflare,
  siCoda, siConfluence, siDiscord, siDiscourse, siDropbox, siDrupal,
  siEgnyte, siGitbook, siGithub, siGitlab, siGmail, siGooglecloud,
  siGoogledrive, siHubspot, siJira, siLinear, siNotion, siOutline,
  siQnap, siTestrail, siWikipedia, siZendesk, siZulip,
};

/** Mapa de ícones lucide de fallback usados no catálogo. */
const FALLBACKS: Record<string, LucideIcon> = {
  FileUp, Globe, Server, HardDrive, Mail, Cloud, Building2, MessagesSquare,
  Hash, MessageCircle, MessageSquare, BookText, BookOpen, Library, FileText,
  Lightbulb, GitBranch, Github, SquareKanban, LifeBuoy, Contact, Phone, Table,
  CircleCheck, LayoutDashboard, Database, Box, Mic, Presentation, ClipboardCheck,
  Webhook, Cable,
};

interface BrandIconProps {
  brandSlug: string | null;
  fallbackIcon: string;
  /** cor de marca (#hex); usada no fallback lucide. */
  color?: string;
  size?: number;
  className?: string;
  /** true = pinta o logo da marca com a cor oficial; false = herda currentColor. */
  brandColor?: boolean;
}

/**
 * Renderiza o logo de marca (simple-icons) quando disponível, senão um ícone
 * lucide de fallback. Mantém a galeria de conectores com cara de marca sem
 * precisar versionar dezenas de PNGs.
 */
export default function BrandIcon({
  brandSlug, fallbackIcon, color, size = 22, className, brandColor = true,
}: BrandIconProps) {
  const brand = brandSlug ? BRANDS[brandSlug] : null;

  if (brand) {
    return (
      <svg
        role="img"
        aria-label={brand.title}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        fill={brandColor ? `#${brand.hex}` : "currentColor"}
      >
        <path d={brand.path} />
      </svg>
    );
  }

  const Fallback = FALLBACKS[fallbackIcon] ?? Cable;
  return <Fallback size={size} className={className} style={color ? { color } : undefined} />;
}
