"use client" // Needs to be a client component for hooks and plugins

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import React from "react"; // Import React for useRef

const testimonials = [
  {
    quote:
      "Uploading invoices to CariNota is incredibly simple. Everything is stored securely, and finding specific documents later with the search function saves us hours each week.",
    name: "Budi Santoso",
    title: "Senior Accountant, Jakarta",
    initials: "BS",
    rating: 5,
  },
  {
    quote:
      "With CariNota, storing both Indonesian and English documents is seamless. The real magic is how quickly I can find exactly what I need later using the search – it's effortless!",
    name: "Dewi Wulandari",
    title: "Tax Consultant, Bali",
    initials: "DW",
    rating: 5,
  },
  {
    quote:
      "I was skeptical about another tool, but CariNota makes uploading and storing receipts so straightforward. Finding them again months later takes seconds, not hours.",
    name: "Rizki Ardianto",
    title: "Finance Manager, Jakarta",
    initials: "RA",
    rating: 5,
  },
  {
    quote:
      "Getting started with CariNota was a breeze. Uploading our initial batch of documents took minutes, and they were instantly organized and searchable.",
    name: "Citra Lestari",
    title: "Office Manager, Denpasar, Bali",
    initials: "CL",
    rating: 5,
  },
  {
    quote:
      "Finally, a simple way to store all our business documents! Uploading is drag-and-drop easy, and finding anything later is surprisingly fast with CariNota.",
    name: "Agus Hermawan",
    title: "Small Business Owner, Jakarta",
    initials: "AH",
    rating: 5,
  },
  {
    quote:
      "Preparing for audits used to be a nightmare of searching through folders. With CariNota, uploading is simple, and finding specific invoices takes just a few clicks.",
    name: "Siti Aminah",
    title: "Internal Auditor, Jakarta",
    initials: "SA",
    rating: 5,
  },
  {
    quote:
      "CariNota simplified our document workflow immensely. Uploading project files is quick, storage is reliable, and searching for past documents is incredibly efficient.",
    name: "Eko Prasetyo",
    title: "Project Manager, Ubud, Bali",
    initials: "EP",
    rating: 5,
  },
];

export default function Testimonials() {
  // Initialize the Autoplay plugin
  const plugin = React.useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  return (
    <section id="testimonials" className="w-full py-12 md:py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-foreground">
              What Our Users Say
            </h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Trusted by accounting professionals across Indonesia
            </p>
          </div>
        </div>

        {/* Carousel implementation */} 
        <Carousel
          plugins={[plugin.current]} // Add the autoplay plugin
          className="w-full max-w-xs sm:max-w-2xl lg:max-w-4xl mx-auto" // Adjust max width as needed
          // onMouseEnter={plugin.current.stop} // Stop on hover (already handled by plugin option)
          // onMouseLeave={plugin.current.reset} // Reset on leave (already handled by plugin option)
          opts={{
            align: "start",
            loop: true,
          }}
        >
          <CarouselContent>
            {testimonials.map((testimonial) => (
              <CarouselItem key={testimonial.name} className="md:basis-1/2 lg:basis-1/3 pl-4"> {/* Adjust basis for number of visible items */} 
                <div className="p-1 h-full"> {/* Add padding for spacing between items */} 
                  <Card className="bg-muted/40 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full"> {/* Ensure card takes full height */} 
                    <CardHeader className="flex flex-row items-center gap-4 pb-4">
                      <Avatar>
                        <AvatarImage src="/placeholder-user.jpg" alt={testimonial.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {testimonial.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-muted-foreground">{testimonial.title}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-muted-foreground italic before:content-[open-quote] after:content-[close-quote]">
                        {testimonial.quote.replace(/^"|"$/g, '')}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" /> {/* Hide controls on smallest screens? */} 
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </div>
    </section>
  );
} 