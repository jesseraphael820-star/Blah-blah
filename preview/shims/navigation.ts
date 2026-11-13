import { mapHref } from "./routes";

export function useRouter() {
  return {
    push: (href: string) => {
      location.hash = mapHref(href);
    },
  };
}
