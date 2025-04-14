import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const testimonials = [
  {
    quote:
      "Arsip Cerdas has revolutionized how our firm handles document management. We're saving hours every week that we used to spend searching for documents.",
    name: "Budi Santoso",
    title: "Senior Accountant, Jakarta",
    initials: "BS",
    rating: 5,
  },
  {
    quote:
      "The multilingual search is incredible. I can find documents in both Indonesian and English without any hassle. It's like having a personal assistant.",
    name: "Dewi Wulandari",
    title: "Tax Consultant, Surabaya",
    initials: "DW",
    rating: 5,
  },
  {
    quote:
      "I was skeptical at first, but after trying Arsip Cerdas, I can't imagine going back. The automatic extraction feature has cut our processing time by more than half.",
    name: "Rizki Ardianto",
    title: "Finance Manager, Bandung",
    initials: "RA",
    rating: 5,
  },
];

export default function Testimonials() {
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
        <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="bg-muted/40 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
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
          ))}
        </div>
      </div>
    </section>
  );
} 