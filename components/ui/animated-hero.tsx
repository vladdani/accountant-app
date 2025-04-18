"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

export function Hero() {
  const { user } = useAuth();

  const videoId = "xvFZjo5PgG0";

  return (
    <section className="w-full py-6 md:py-16 lg:py-20 bg-background border-b">
      <div className="container px-4 md:px-6 mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none"
              >
                Find Any Business Document in Seconds
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-xl font-semibold text-primary mb-2"
              >
                No setup, no chaos. Just upload and done.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="max-w-[700px] text-muted-foreground md:text-xl/relaxed"
              >
                Designed for Indonesian companies. CariNota instantly extracts, organizes, and makes your documents searchable—across teams, languages, and formats.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col gap-2 min-[400px]:flex-row"
            >
              {!user ? (
                <Button size="lg" asChild>
                  <Link href="/login">Try CariNota For Free</Link>
                </Button>
              ) : (
                <Button size="lg" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              )}
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex items-center justify-center"
          >
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative w-full aspect-video cursor-pointer group overflow-hidden rounded-xl border shadow-xl">
                  <Image
                    src="/images/placeholder-organized-data.jpeg"
                    alt="CariNota dashboard showing organized data"
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                    <PlayCircle className="w-16 h-16 text-white/80 group-hover:text-white transition-colors duration-300" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-3xl p-0 border-0">
                <div className="aspect-video">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  ></iframe>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
