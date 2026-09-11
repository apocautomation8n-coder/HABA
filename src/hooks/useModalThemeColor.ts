import { useEffect } from "react";

/**
 * Hook to dynamically darken iOS Safari status bar / theme-color when a modal is open.
 * On iOS, the area behind the battery, clock and notch is colored by <meta name="theme-color">.
 * Switching to #0f172a when modal opens darkens that area seamlessly.
 */
export function useModalThemeColor(isOpen: boolean, darkColor: string = "#0f172a") {
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    let created = false;

    if (!metaTheme) {
      metaTheme = document.createElement("meta");
      metaTheme.name = "theme-color";
      document.head.appendChild(metaTheme);
      created = true;
    }

    const prevColor = metaTheme.getAttribute("content") || "#3BB578";
    metaTheme.setAttribute("content", darkColor);

    return () => {
      if (metaTheme) {
        metaTheme.setAttribute("content", prevColor);
        if (created && metaTheme.parentNode) {
          metaTheme.parentNode.removeChild(metaTheme);
        }
      }
    };
  }, [isOpen, darkColor]);
}
