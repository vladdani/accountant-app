import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What file types are supported?",
    answer:
      "We currently support PDF, CSV, XLS, JPG, PNG, and HEIC files. We are continuously working to expand our supported formats.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes, data security is our top priority. We use Supabase for secure storage and authentication, employing industry-standard encryption and security practices. Your documents are stored securely and only accessible by you.",
  },
  {
    question: "How does the AI extraction work?",
    answer:
      "We utilize advanced AI models (Google Gemini via Vertex AI) to analyze your uploaded documents and extract key information like dates, amounts, suppliers, and document types automatically, saving you manual data entry time.",
  },
  {
    question: "What languages does the search support?",
    answer:
      "Our semantic search is designed to understand queries in both Bahasa Indonesia and English, allowing you to find documents using natural language in either language.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes, you can manage your subscription, including cancellations, through your billing dashboard powered by Stripe. If you cancel, you will retain access until the end of your current billing period.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-foreground">
              Frequently Asked Questions
            </h2>
          </div>
        </div>
        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
} 