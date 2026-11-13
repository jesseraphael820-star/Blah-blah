/** Rotas da prévia estática: tudo vive em uma página, roteado pelo hash. */
export const STUDIO_HASHES = ["estudio", "editor", "foto", "recentes", "favoritos", "historico", "guasha", "habitos", "config"];
export const PRIVACY_HASH = "politica-privacidade";

export function mapHref(href: string): string {
  if (href === "/studio") return "#estudio";
  if (href === "/privacidade") return `#${PRIVACY_HASH}`;
  if (href === "/") return "#inicio";
  return href;
}
