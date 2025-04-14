import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquareText,
  ScanSearch,
  Search,
  Globe,
  ShieldCheck,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: <MessageSquareText className="h-8 w-8 text-primary" />,
    title: "WhatsApp Integration (coming soon)",
    description:
      "Send documents directly through WhatsApp for seamless integration with your existing workflow.",
  },
  {
    icon: <ScanSearch className="h-8 w-8 text-primary" />,
    title: "Automatic Extraction",
    description:
      "Our AI automatically extracts key information from invoices, receipts, and financial documents.",
  },
  {
    icon: <Search className="h-8 w-8 text-primary" />,
    title: "Semantic Search",
    description:
      "Find documents using natural language queries in both Indonesian and English.",
  },
  {
    icon: <Globe className="h-8 w-8 text-primary" />,
    title: "Multilingual Support",
    description:
      "Full support for Indonesian and English language documents and search queries.",
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: "Compliance Ready",
    description:
      "Designed with Indonesian accounting standards and regulations in mind.",
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "Time Saving",
    description:
      "Reduce document search time by up to 90% with our intelligent organization system.",
  },
];

export function KeyFeatures() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-foreground">
              Key Features
            </h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Our platform streamlines document management for accounting professionals, saving you time and reducing manual effort.
            </p>
          </div>
        </div>
        <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-background shadow-sm hover:shadow-md transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                {feature.icon}
                <CardTitle className="text-lg font-semibold">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
} 