import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  description: string;
  className?: string;
}

export function SectionHeading({
  title,
  description,
  className
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}> 
      <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-3">
        {title}
      </h2>
      <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
        {description}
      </p>
    </div>
  );
} 