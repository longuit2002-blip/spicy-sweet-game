"use client";

import { Icon } from "@/components/ui/icon";

interface MobileChatFABProps {
  onClick: () => void;
  label: string;
}

export function MobileChatFAB({ onClick, label }: MobileChatFABProps) {
  return (
    <button
      type="button"
      className="fixed bottom-6 right-6 z-30 xl:hidden w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      onClick={onClick}
      aria-label={label}
    >
      <Icon name="chat" size={24} fill={1} className="text-2xl" />
    </button>
  );
}
