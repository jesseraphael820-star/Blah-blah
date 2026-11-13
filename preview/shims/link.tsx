import type { AnchorHTMLAttributes } from "react";
import { mapHref } from "./routes";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={mapHref(href)} {...rest} />;
}
