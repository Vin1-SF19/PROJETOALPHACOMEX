"use client";

import { cn } from '@/lib/utils';

interface GradientBlobCardProps {
  children?: React.ReactNode;
  className?: string;
}

export function GradientBlobCard({ children, className }: GradientBlobCardProps) {
  return (
    <div
      className={cn(
        'relative w-full rounded-[14px]',
        'shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff] dark:shadow-[20px_20px_60px_#111,-20px_-20px_60px_#222]',
        'overflow-hidden',
        className,
      )}
    >
      {/* Glassy Background */}
      <div
        aria-hidden="true"
        className="absolute inset-[5px] bg-white/80 dark:bg-black/50 backdrop-blur-[24px] rounded-[10px] outline outline-2 outline-white dark:outline-gray-700 z-10"
      />

      {/* Animated Gradient Blob */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 w-[150px] h-[150px] rounded-full opacity-100 filter blur-[12px] z-[15] animate-blob bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500"
      />

      {/* Conteúdo do card (props do pipeline) */}
      <div className="relative z-20 p-3 w-full">{children}</div>
    </div>
  );
}

export default GradientBlobCard;
