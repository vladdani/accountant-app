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
    name: "Ahmad Putra",
    title: "Operations Director, Bandung",
    initials: "AP",
    rating: 5,
  },
];

export default function Testimonials() {
  const plugin = React.useRef(
    Autoplay({ 
      delay: 4000, 
      stopOnInteraction: false, 
      rootNode: (emblaRoot) => emblaRoot.parentElement 
    })
  );

  return (
    <section id="testimonials" className="w-full py-12 md:py-24 bg-muted/50">
      <div className="container px-4 md:px-6 mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Our Clients Love CariNota
            </h2>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-lg">
              See what businesses across Indonesia are saying about their experience with CariNota
            </p>
          </div>
        </div>
        <Carousel
          plugins={[plugin.current]}
          className="mx-auto max-w-5xl mt-8"
          onMouseEnter={plugin.current.stop}
          onMouseLeave={plugin.current.reset}
        >
          <CarouselContent>
            {testimonials.map((testimonial, index) => (
              <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3 p-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2">
                      <Avatar>
                        <AvatarFallback>{testimonial.initials}</AvatarFallback>
                        <AvatarImage src="" alt={testimonial.name} />
                      </Avatar>
                      <div>
                        <h4 className="text-sm font-semibold">
                          {testimonial.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {testimonial.title}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="flex space-x-1 mt-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < testimonial.rating
                              ? "text-primary"
                              : "text-muted"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center mt-4 space-x-2">
            <CarouselPrevious className="relative left-0 translate-x-0 bg-background" />
            <CarouselNext className="relative right-0 translate-x-0 bg-background" />
          </div>
        </Carousel>
      </div>
    </section>
  );
} 