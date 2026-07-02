"use client";

import { Eye } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function PromptPreview({ prompt }: { prompt: string }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="overflow-hidden rounded-lg border border-border/60 bg-card/30"
    >
      <AccordionItem value="prompt" className="border-0">
        <AccordionTrigger className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground hover:no-underline">
          <span className="flex items-center gap-2">
            <Eye className="size-3.5 text-primary" />
            Prompt preview
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground scrollbar-thin">
            {prompt}
          </pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
