'use client';

import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";
import { useState } from "react";
import VideoModal from "@/components/VideoModal";

export default function Hero() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40 bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_550px] lg:gap-12 xl:grid-cols-[1fr_650px]">
          <div className="flex flex-col justify-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Unlock Your Financial Data with AI
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Effortlessly extract key information from invoices, receipts, and bank statements. Search and analyze your financial documents like never before.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-3 min-[400px]:flex-row"
            >
              <Button size="lg" asChild>
                <Link href="/login">Get Started Free</Link>
              </Button>
              <Button variant="outline" size="lg" onClick={() => setIsVideoModalOpen(true)}>
                <PlayCircle className="mr-2 h-5 w-5" />
                Watch Demo (1 min)
              </Button>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex justify-center items-center"
          >
            <div className="w-full max-w-[650px] aspect-[16/9] bg-muted rounded-xl shadow-xl border flex items-center justify-center">
               <p className="text-muted-foreground">[App Screenshot Placeholder]</p>
            </div>
          </motion.div>
        </div>
      </div>
      <VideoModal isOpen={isVideoModalOpen} onClose={() => setIsVideoModalOpen(false)} videoId="your_youtube_video_id" />
    </section>
  );
} 