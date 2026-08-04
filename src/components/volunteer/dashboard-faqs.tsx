'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { DashboardFaq } from '@/content/volunteer-dashboard'

/**
 * The questions volunteers ask about their own application.
 *
 * `type="multiple"` rather than `"single"`: someone comparing "can I change my
 * answers?" against "can I change department?" should be able to hold both open
 * at once. Radix supplies the roles, `aria-expanded`, `aria-controls` and the
 * arrow-key roving focus, so the accordion is fully operable from the keyboard.
 *
 * Every answer is emitted in the HTML whether or not its panel is open, so the
 * content survives with JavaScript disabled even though the interaction does
 * not.
 */
export function DashboardFaqs({ faqs }: { faqs: DashboardFaq[] }) {
  return (
    <Accordion type="multiple" className="w-full">
      {faqs.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id} className="last:border-0">
          <AccordionTrigger className="py-4 text-sm normal-case tracking-normal">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="pb-4 text-sm">{faq.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
