import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { Outlet, useNavigate } from "react-router";
import { App } from "@capacitor/app";
import { SystemBars } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

import {
  selectDevicePlatform,
  selectOrientationLock,
  selectScannerIsScanning,
} from "@/redux/device";
import { selectShouldConstrainViewport } from "@/redux/preferences";

import useScrollToTop from "@/hooks/useScrollToTop";

import { navigateOnValidUri } from "@/util/uri";

import BottomNavigation from "./BottomNavigation";

export default function MainLayout() {
  const navigate = useNavigate();
  useScrollToTop();

  const platform = useSelector(selectDevicePlatform);
  const orientationLock = useSelector(selectOrientationLock);
  const shouldConstrainViewport = useSelector(selectShouldConstrainViewport);

  const html = useMemo(() => document.querySelector("html"), []);
  const body = useMemo(() => document.querySelector("body"), []);

  // Dark mode is handled by AppProvider (global, all phases)

  useEffect(
    function setPlatformCss() {
      if (!html || !body) {
        return () => {};
      }

      // --------
      // Fullscreen + orientation lock
      if (orientationLock === "landscape") {
        html.classList.add("fullscreen");
      } else {
        html.classList.remove("fullscreen");
      }

      if (platform !== "web") {
        (async () => {
          await ScreenOrientation.lock({ orientation: orientationLock });
          if (orientationLock === "landscape") {
            await SystemBars.hide();
          } else {
            await SystemBars.show();
          }
        })();
      }

      // --------
      // Fake "phone" border on web if window is larger than 480px wide
      if (
        platform === "web" &&
        html.clientWidth > 480 &&
        shouldConstrainViewport
      ) {
        body.classList.add(
          "border-8",
          "border-neutral-1000",
          "rounded-lg",
          "shadow-xl"
        );

        if (orientationLock === "landscape") {
          body.style.maxWidth = "960px";
          body.style.maxHeight = "480px";
        } else {
          body.style.maxWidth = "480px";
          body.style.maxHeight = "960px";
        }
      }

      return () => {
        html.classList.remove("fullscreen");

        if (platform !== "web") {
          SystemBars.show().catch(() => {});
        }

        body.classList.remove(
          "border-8",
          "border-neutral-1000",
          "rounded-lg",
          "shadow-xl"
        );

        body.style.maxWidth = "";
        body.style.maxHeight = "";
      };
    },
    [platform, shouldConstrainViewport, orientationLock, html, body]
  );

  const isScanning = useSelector(selectScannerIsScanning);
  useEffect(
    function forceTransparentContainer() {
      const isOverlayOpen = isScanning;

      if (!html) {
        return () => {};
      }

      if (isOverlayOpen) {
        html.classList.add("bg-transparent");
        html.classList.remove("bg-neutral-1000/90");
      }

      return () => {
        html.classList.remove("bg-transparent");
        html.classList.add("bg-neutral-1000/90");
      };
    },
    [isScanning, html]
  );

  useEffect(
    function registerAppUrlListener() {
      const listener = App.addListener("appUrlOpen", async ({ url }) => {
        const { navTo, navState } = await navigateOnValidUri(url);
        if (navTo) {
          navigate(navTo, { state: navState });
        }
      });

      return () => {
        listener.then((l) => l.remove());
      };
    },
    [navigate]
  );

  // [!] see index.css for #container and <main> styles
  return (
    <>
      <div
        id="scannerOutput"
        className={`${!isScanning ? "opacity-0" : ""} bg-transparent`}
      />
      <div
        className={`flex flex-col h-full ${isScanning ? "bg-transparent" : "bg-primary-50 dark:bg-primarydark-50 dark:text-neutral-50"}`}
      >
        <main>
          <Outlet />
        </main>
        <BottomNavigation />
      </div>
    </>
  );
}
