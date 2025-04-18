"use client";

import { Compare as CompareComponent } from "@/components/ui/compare";
import { SectionHeading } from "@/components/blocks/section-heading";
import React from "react";

export function Compare() {
  return (
    <section className="w-full py-12 md:py-24 bg-muted/30">
      <div className="container px-4 md:px-6 mx-auto max-w-6xl">
        <SectionHeading
          title="Transform Your Document Management"
          description="See how CariNota turns chaos into clarity"
          className="text-center mb-12"
        />
        
        <div className="flex justify-center w-full overflow-hidden rounded-lg border">
          <div className="aspect-[16/9] w-full max-w-4xl relative">
            <CompareComponent
              className="w-full h-full"
              firstImage="/images/placeholder-messy-shelf.jpg"
              secondImage="/images/placeholder-organized-data.jpeg"
              showHandlebar={true}
              autoplay={false}
              firstImageClassName="object-cover object-center"
              secondImageClassname="object-cover object-center"
            />
            
            {/* Before overlay */}
            <div className="absolute inset-0 left-0 right-1/2 bg-black/30 flex flex-col items-center justify-center text-white p-4 pointer-events-none">
              <h3 className="text-2xl font-bold">Before CariNota</h3>
              <ul className="list-disc mt-4 max-w-xs space-y-2 text-sm">
                <li>Cabinets stuffed with paperwork</li>
                <li>Hours spent searching for documents</li>
                <li>Lost receipts and invoices</li>
                <li>Difficult to share with colleagues</li>
                <li>High risk of physical damage</li>
              </ul>
            </div>
            
            {/* After overlay */}
            <div className="absolute inset-0 left-1/2 right-0 bg-primary/30 flex flex-col items-center justify-center text-white p-4 pointer-events-none">
              <h3 className="text-2xl font-bold">With CariNota</h3>
              <ul className="list-disc mt-4 max-w-xs space-y-2 text-sm">
                <li>All documents digitally organized</li>
                <li>Instant search by keyword or content</li>
                <li>Automated extraction of key data</li>
                <li>Secure backup in the cloud</li>
                <li>Easy sharing and collaboration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 