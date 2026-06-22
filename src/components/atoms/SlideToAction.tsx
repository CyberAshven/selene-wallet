/* eslint-disable @typescript-eslint/no-use-before-define */
import { useRef } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";

import SeleneLogo from "./SeleneLogo";

interface Props {
  label: string;
  onSlide: () => void;
  disabled?: boolean;
}

export default function SlideToAction({
  label,
  onSlide,
  disabled = false,
}: Props) {
  const knobRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);

  const offsetX = useRef<number>(0);

  const endX = useRef<number>(0);

  const stopDragging = () => {
    isDragging.current = false;

    document.body.classList.remove("cursor-grabbing");
    document.body.removeEventListener("pointermove", handlePointerMove);
    document.body.removeEventListener("pointerup", handlePointerUp);

    if (knobRef.current === null) return;
    if (bannerRef.current === null) return;

    knobRef.current.style.transform = `translateX(0)`;
    knobRef.current.style.transition = `0.3s`;
    bannerRef.current.style.width = `0`;
  };

  const startDragging = (x: number) => {
    if (knobRef.current === null) return;
    if (knobRef.current.parentElement === null) return;

    offsetX.current = x;
    endX.current =
      knobRef.current.parentElement.getBoundingClientRect().width -
      knobRef.current.getBoundingClientRect().width / 1.2;

    isDragging.current = true;
    document.body.addEventListener("pointermove", handlePointerMove);
    document.body.addEventListener("pointerup", handlePointerUp);
    document.body.classList.add("cursor-grabbing");
  };

  const handleConfirm = () => {
    stopDragging();
    onSlide();
  };
  const handlePointerMove = (e) => {
    //e.preventDefault();
    if (!isDragging.current) return;
    if (knobRef.current === null) return;
    if (bannerRef.current === null) return;

    const x = e.clientX;

    const transformX = Math.max(0, Math.min(endX.current, x - offsetX.current));
    const knobWidth = knobRef.current.getBoundingClientRect().width;

    knobRef.current.style.transition = `none`;
    knobRef.current.style.transform = `translateX(${transformX}px)`;
    bannerRef.current.style.transition = `none`;
    bannerRef.current.style.width = `${transformX + knobWidth}px`;

    if (transformX === endX.current) {
      handleConfirm();
    }
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    stopDragging();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    startDragging(e.clientX);
  };

  const disabledClasses = disabled
    ? "bg-neutral-200 opacity-50 pointer-events-none"
    : "bg-primary-200";

  return (
    <div
      data-testid="slide-to-action"
      className={`border border-primary-200 shadow-inner rounded-full h-12 flex items-center relative ${disabledClasses}`}
    >
      <div
        ref={bannerRef}
        className="h-14 w-0 bg-primary/90 absolute rounded-full"
        onPointerUp={handlePointerUp}
      />
      <div
        onPointerDown={handlePointerDown}
        ref={knobRef}
        className="h-16 w-16 relative z-10 flex items-center justify-center bg-primary p-0.5 rounded-full"
        style={{ touchAction: "none" }}
      >
        <SeleneLogo className="w-full h-full" />
      </div>
      <div className="text-lg font-bold text-primary-900 flex flex-1 items-center justify-evenly">
        <span>{label}</span>
        <ArrowRightOutlined className="ml-1 font-bold text-xl" />
      </div>
    </div>
  );
}
