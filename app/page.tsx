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
import Hero from "@/components/landing/hero";
import { KeyFeatures } from "@/components/landing/key-features";
import Testimonials from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/footer";
import { Suspense } from "react";
import PostHogPageView from "@/components/PostHogPageView";

/* eslint-disable @typescript-eslint/no-unused-vars */

// Update workflowSteps to be more generic
const workflowSteps = [
  {
    title: "Step One",
    description: "First step of your workflow",
    preview: <TypewriterEffect text="Processing step one..." />
  },
  {
    title: "Step Two",
    description: "Second step of your workflow",
    preview: <TypewriterEffect text="Executing step two..." />
  },
  {
    title: "Step Three",
    description: "Third step of your workflow",
    preview: <TypewriterEffect text="Running step three..." />
  },
  {
    title: "Step Four",
    description: "Fourth step of your workflow",
    preview: <TypewriterEffect text="Completing step four..." />
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
        <KeyFeatures />
        <Testimonials />
        <Faq />
      </main>
      <Footer />
    </Suspense>
  );
}

