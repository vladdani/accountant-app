"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrialStatus } from '@/hooks/useTrialStatus';
// import { DemoWidget } from '@/components/DemoWidget';
// import { MetricCard } from '@/components/MetricCard';
import { TypewriterEffect } from '@/components/TypewriterEffect';
import { FaReddit } from 'react-icons/fa';
import { 
  FaGithub, 
  FaDiscord, 
  FaProductHunt,
  FaXTwitter,
  FaHackerNews,
  FaInstagram,
  FaTiktok,
  FaYoutube
} from 'react-icons/fa6';
import { 
 Lock, CreditCard, Moon
} from 'lucide-react';
import { useScroll, useTransform } from "framer-motion";
// import { Link as ScrollLink } from 'react-scroll';
// import { VideoModal } from '@/components/VideoModal';
import { Hero } from "@/components/ui/animated-hero";
import { WhyCariNota } from "@/components/landing/key-features";
import { Pricing } from "@/components/blocks/pricing";
import Testimonials from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { Footerdemo } from "@/components/ui/footer-section";
import { Suspense } from "react";
import PostHogPageView from "@/components/PostHogPageView";
import { Compare } from "@/components/landing/compare";

/* eslint-disable @typescript-eslint/no-unused-vars */

// Update workflowSteps to be more generic
const workflowSteps = [
  {
    title: "Step One",
    description: "First step of your workflow",
    preview: <TypewriterEffect words={[{ text: "Processing step one..." }]} />
  },
  {
    title: "Step Two",
    description: "Second step of your workflow",
    preview: <TypewriterEffect words={[{ text: "Executing step two..." }]} />
  },
  {
    title: "Step Three",
    description: "Third step of your workflow",
    preview: <TypewriterEffect words={[{ text: "Running step three..." }]} />
  },
  {
    title: "Step Four",
    description: "Fourth step of your workflow",
    preview: <TypewriterEffect words={[{ text: "Completing step four..." }]} />
  }
];

// Update platforms to be generic
const platforms = [
  { name: 'Platform 1', icon: FaGithub },
  { name: 'Platform 2', icon: FaDiscord },
  { name: 'Platform 3', icon: FaReddit },
  { name: 'Platform 4', icon: FaProductHunt },
  { name: 'Platform 5', icon: FaXTwitter },
  { name: 'Platform 6', icon: FaHackerNews },
  { name: 'Platform 7', icon: FaInstagram },
  { name: 'Platform 8', icon: FaTiktok },
  { name: 'Platform 9', icon: FaYoutube }
];

// Update workflowSections to be generic
const workflowSections = [
  {
    id: "overview",
    title: "Overview",
    description: "Everything you need to build modern SaaS applications",
    bgColor: "bg-white dark:bg-[#0B1120]"
  },
  {
    id: "authentication",
    title: "Authentication",
    description: "Secure user authentication with multiple providers",
    bgColor: "bg-slate-50 dark:bg-[#0B1120]",
    metrics: [
      { label: "Auth Providers", value: "5+" },
      { label: "Setup Time", value: "2min" },
      { label: "Security", value: "A+" }
    ]
  },
  {
    id: "payments",
    title: "Payments",
    description: "Seamless payment integration with Stripe",
    bgColor: "bg-white dark:bg-[#0B1120]",
    metrics: [
      { label: "Integration", value: "1-Click" },
      { label: "Providers", value: "Stripe" },
      { label: "Setup Time", value: "5min" }
    ]
  },
  {
    id: "database",
    title: "Database",
    description: "Powerful database with Supabase integration",
    bgColor: "bg-slate-50 dark:bg-[#0B1120]",
    metrics: [
      { label: "Database", value: "PostgreSQL" },
      { label: "Real-time", value: "Yes" },
      { label: "Security", value: "RLS" }
    ]
  },
  {
    id: "features",
    title: "Features",
    description: "Additional features to enhance your application",
    bgColor: "bg-white dark:bg-[#0B1120]",
    metrics: [
      { label: "Dark Mode", value: "Built-in" },
      { label: "Components", value: "50+" },
      { label: "TypeScript", value: "100%" }
    ]
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "Simple, transparent pricing for your needs",
    bgColor: "bg-slate-50 dark:bg-[#0B1120]"
  }
];

// Custom Hook to create section progress values
function useSectionProgressValues(numSections: number) {
  const { scrollYProgress } = useScroll();
  
  // Create all transforms at once, at the top level
  const section1Progress = useTransform(
    scrollYProgress,
    [0 / numSections, 1 / numSections],
    [0, 1]
  );
  const section2Progress = useTransform(
    scrollYProgress,
    [1 / numSections, 2 / numSections],
    [0, 1]
  );
  const section3Progress = useTransform(
    scrollYProgress,
    [2 / numSections, 3 / numSections],
    [0, 1]
  );
  const section4Progress = useTransform(
    scrollYProgress,
    [3 / numSections, 4 / numSections],
    [0, 1]
  );

  return [section1Progress, section2Progress, section3Progress, section4Progress];
}

// Feature cards data
const featureCards = [
  {
    title: "Authentication",
    description: "Supabase auth with social providers",
    icon: <Lock className="h-6 w-6 text-primary" />,
    bgGradient: "from-blue-500/10 to-purple-500/10"
  },
  {
    title: "Payments",
    description: "Stripe subscription management",
    icon: <CreditCard className="h-6 w-6 text-primary" />,
    bgGradient: "from-green-500/10 to-emerald-500/10"
  },
  {
    title: "Dark Mode",
    description: "Built-in theme management",
    icon: <Moon className="h-6 w-6 text-primary" />,
    bgGradient: "from-orange-500/10 to-red-500/10"
  }
];

// Define the pricing plans data
const pricingPlans = [
  {
    name: "Starter",
    price: "120000", // Price as string for formatting
    yearlyPrice: "0", // Not used, but needed by interface
    period: "per month",
    features: [
      "Limited storage (5Gb)",
      "Slower AI model",
      "72-hour support response time",
    ],
    description: "Perfect for micro businesses who have no accountant or admin but want to keep track of their documents.",
    buttonText: "Get Started", // Or choose appropriate text
    href: "https://buy.stripe.com/00g9BO0rUdVz3C028b", // Update link
    isPopular: false,
  },
  {
    name: "Professional",
    price: "550000",
    yearlyPrice: "0",
    period: "per month",
    features: [
      "Unlimited storage",
      "Fast AI model",
      "12-hour support response time",
      "Exports",
    ],
    description: "Perfect for small and medium sized companies who have 1000+ documents a month and want to keep their documents tidy and organized.",
    buttonText: "Get Started",
    href: "https://buy.stripe.com/4gwdS4fmO18Na0o9AE", // Update link
    isPopular: true, // Make this popular
  },
  {
    name: "Enterprise",
    price: "Contact Sales", // Special case for display
    yearlyPrice: "0",
    period: "", // No period needed
    features: [
      "Unlimited storage",
      "Fast AI model",
      "Dedicated support",
      "Exports",
      "Custom Integrations",
    ],
    description: "A highly customized plan for big businesses with 10,000+ documents a month.",
    buttonText: "Contact Sales",
    href: "/contact", // Link to contact page
    isPopular: false,
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { isInTrial } = useTrialStatus();
  const [activeSection, setActiveSection] = useState("overview");
  const sectionProgressValues = useSectionProgressValues(workflowSections.length);
  
  // const router = useRouter();

  // const [dashboardRef, inView] = useInView({
  //   triggerOnce: true,
  //   threshold: 0.1
  // });

  // const { scrollYProgress } = useScroll();

  // const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <Suspense>
      <PostHogPageView />
      <main className="flex-1">
        <Hero />
        <WhyCariNota />
        <Compare />
        <div className="flex justify-center w-full">
          <Pricing plans={pricingPlans} />
        </div>
        <Testimonials />
        <Faq />
      </main>
      <Footerdemo />
    </Suspense>
  );
}

