/* eslint-disable react/no-array-index-key */
import { Children, useEffect, useState } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";

import Button from "@/atoms/Button";

interface CarouselProps {
  children: React.ReactNode;
  autoRotateInterval?: number;
}

export default function Carousel({
  children,
  autoRotateInterval = 10000,
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slides = Children.toArray(children).filter(Boolean);

  // ----------------

  useEffect(
    function autoRotate() {
      if (isPaused || slides.length <= 1) {
        return () => {};
      }

      const timer = setInterval(() => {
        setCurrentIndex((i) => (i + 1) % slides.length);
      }, autoRotateInterval);

      return () => clearInterval(timer);
    },
    [slides.length, autoRotateInterval, currentIndex, isPaused]
  );

  if (slides.length === 0) {
    return null;
  }

  // ----------------

  const goTo = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
  };

  const goPrev = () =>
    goTo(currentIndex === 0 ? slides.length - 1 : currentIndex - 1);

  const goNext = () => goTo((currentIndex + 1) % slides.length);

  // ----------------

  return (
    <div onClick={() => setIsPaused(true)}>
      <div className="overflow-hidden rounded-lg border border-primary dark:border-primarydark-200 shadow-sm">
        {slides[currentIndex]}
      </div>

      {slides.length > 1 && (
        <div className="w-1/2 mx-auto py-1 px-8 bg-primary-300 border border-primary border-t-0 dark:border-primarydark-200 dark:bg-primarydark-100 rounded-b shadow-sm dark:shadow-none flex items-center justify-between gap-4">
          <Button
            icon={LeftOutlined}
            iconSize="lg"
            padding="1"
            onClick={goPrev}
          />
          <div className="flex gap-3">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                className={`w-3 h-3 rounded-full transition-colors ${index === currentIndex ? "bg-primary" : "bg-neutral-500"}`}
              />
            ))}
          </div>
          <Button
            icon={RightOutlined}
            iconSize="lg"
            padding="1"
            onClick={goNext}
          />
        </div>
      )}
    </div>
  );
}
