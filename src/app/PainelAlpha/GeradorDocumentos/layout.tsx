import "./gerador-documentos.css";

export default function GeradorDocumentosLayout({ children }: { children: React.ReactNode }) {
  return <div className="gd-shell relative min-h-screen">{children}</div>;
}
