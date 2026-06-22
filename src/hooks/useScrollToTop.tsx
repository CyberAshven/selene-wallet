import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

export default function useScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const main = document.getElementsByTagName("main")[0];
    if (main == null) return;
    main.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname]);
}
