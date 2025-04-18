"use client";

import React from "react";
import { SectionHeading } from "@/components/blocks/section-heading";
import { cn } from "@/lib/utils";

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesSectionProps {
  title: string;
  description: string;
  features: Feature[];
}

export function FeaturesSectionWithHoverEffects({
  title,
  description,
  features
}: FeaturesSectionProps) {
  return (
    <section className="w-full py-12 md:py-24 bg-background">
      <div className="container px-4 md:px-6 mx-auto max-w-6xl">
        <SectionHeading
          title={title}
          description={description}
          className="text-center mb-12"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto relative z-10">
          {features.map((feature, index) => (
            <FeatureCard 
              key={index}
              feature={feature}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ 
  feature, 
  index 
}: { 
  feature: Feature;
  index: number;
}) {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {/* Hover gradient effect */}
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-muted/50 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-muted/50 to-transparent pointer-events-none" />
      )}
      
      {/* Emoji icon */}
      <div className="mb-4 relative z-10 px-10 text-3xl">
        {feature.icon}
      </div>
      
      {/* Title with animated left border */}
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-muted dark:bg-neutral-700 group-hover/feature:bg-primary transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-foreground">
          {feature.title}
        </span>
      </div>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-xs relative z-10 px-10 group-hover/feature:translate-x-2 transition duration-200">
        {feature.description}
      </p>
    </div>
  );
} 