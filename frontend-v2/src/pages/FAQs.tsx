import API from '@/api/api';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from '@/components/ui/accordion';
import { FAQ_CATEGORIES } from '@/data/faqData';

function logQuestionClick(question: string) {
    void API.post('analytics/faq-click', { question }).catch(() => {
        // Analytics failures are intentionally ignored
    });
}

export function FAQContent({ compact = false }: { compact?: boolean }) {
    return (
        <div className={compact ? 'space-y-4' : 'space-y-6'}>
            {!compact && (
                <h2 className="text-2xl font-bold text-foreground">
                    Frequently Asked Questions
                </h2>
            )}
            {Object.entries(FAQ_CATEGORIES).map(
                ([category, questions]) => (
                    <div key={category}>
                        <h3 className={compact ? "text-base font-semibold text-foreground mb-2" : "text-lg font-semibold text-foreground mb-2"}>
                            {category}
                        </h3>
                        <div className="bg-card rounded-lg border border-border">
                            <Accordion type="single" collapsible>
                                {questions.map((faq, index) => (
                                    <AccordionItem
                                        key={`${category}-${index}`}
                                        value={`${category}-${index}`}
                                    >
                                        <AccordionTrigger
                                            onClick={() =>
                                                logQuestionClick(
                                                    faq.question
                                                )
                                            }
                                            className="px-4 text-foreground hover:no-underline hover:text-[#556830]"
                                        >
                                            {faq.question}
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 text-muted-foreground">
                                            <p>{faq.answer}</p>
                                            {faq.list && (
                                                <ul className="list-disc list-outside pl-6 mt-2 space-y-1">
                                                    {faq.list.map(
                                                        (item, i) => (
                                                            <li key={i}>
                                                                {item}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            )}
                                            {faq.extra && (
                                                <p className="mt-2">
                                                    {faq.extra}
                                                </p>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}

export default function FAQs() {
    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="max-w-3xl mx-auto">
                <FAQContent />
            </div>
        </div>
    );
}
