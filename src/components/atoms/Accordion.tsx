// TODO: refactor this component it kinda sucks too
import { useState } from "react";
import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";

import NullComponent from "@/atoms/NullComponent";

interface AccordionProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  open?: boolean;
  children: React.ReactNode;
}

export default function Accordion({
  icon = NullComponent,
  title = "",
  open = false,
  children,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(open);
  const Icon = icon;

  return (
    <div className="bg-neutral-700 rounded-lg p-2 my-1 text-neutral-50 dark:bg-neutral-900 dark:border dark:border-neutral-1000">
      <button
        type="button"
        tabIndex={0}
        className="text-lg font-medium p-1 flex items-center w-full"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex-1 flex items-center">
          <Icon className="text-xl text-primary mr-1.5" />
          <span>{title}</span>
        </span>
        {isOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}
      </button>
      {isOpen && (
        <div className="mt-2 text-neutral-500 dark:text-neutral-100 rounded-sm bg-primary-50 dark:bg-neutral-700 divide-y divide-neutral-100 dark:divide-primarydark-100 dark:border-primarydark-200 dark:border">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccordionChildProps {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  description?: string;
  children: React.ReactNode;
}

function AccordionChild({
  icon = NullComponent,
  label = "",
  description = "",
  children,
}: AccordionChildProps) {
  const Icon = icon;
  return (
    <div className="p-2.5">
      <div className="flex justify-between items-center">
        {label && (
          <div className="flex flex-2 items-center flex-nowrap items-center">
            <Icon className="text-xl mr-1" />
            {label}
          </div>
        )}
        <div className="flex items-center flex-1 justify-end">{children}</div>
      </div>
      {description && <div className="pt-2 text-sm">{description}</div>}
    </div>
  );
}

Accordion.Child = AccordionChild;
