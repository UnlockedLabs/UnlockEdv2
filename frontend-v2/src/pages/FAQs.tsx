import API from '@/api/api';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from '@/components/ui/accordion';

interface FAQEntry {
    question: string;
    answer: string;
    list?: string[];
    extra?: string;
}

const FAQ_CATEGORIES: Record<string, FAQEntry[]> = {
    Overview: [
        {
            question: "What is UnlockEd's Knowledge Center?",
            answer: "UnlockEd's Knowledge Center is a digital library filled with videos, articles, and other learning resources. It includes a wide variety of topics, from academic subjects to life skills, job preparation, and personal interests. You can browse freely or search for something specific to support your learning goals."
        },
        {
            question: "What resources are in UnlockEd's Knowledge Center?",
            answer: "UnlockEd gives you access to a wide variety of learning materials, including videos and articles. You'll find everything from coding tutorials to high school math study guides, resume building tips, science videos, and philosophy forums. Explore and enjoy!"
        },
        {
            question: 'Who can use the Knowledge Center?',
            answer: "Right now, access is limited as we test and improve UnlockEd. If you know someone who might benefit from using it, let the staff know -- we're hoping to expand soon!"
        }
    ],
    'Finding and Using Content': [
        {
            question: 'What can I use UnlockEd for?',
            answer: 'You can use UnlockEd to:',
            list: [
                "Learn about topics you're interested in",
                'Study for exams, including the GED',
                'Explore new hobbies or skills',
                'Prepare for job applications and reentry',
                'Get guidance on finances, health, and more'
            ],
            extra: "With UnlockEd, there's no specific path or program you have to follow. You can just explore."
        },
        {
            question: 'Can UnlockEd help me study for my GED?',
            answer: "You can search for study materials on the topics you're learning. UnlockEd isn't a full GED prep program, but it gives you access to a large collection of educational resources that may help."
        },
        {
            question: "Can UnlockEd help with a certification I'm going for?",
            answer: "Try searching for materials related to your program! If you don't find what you need, please let the staff know -- we may be able to add more relevant content."
        },
        {
            question:
                'Can I find information on hobbies or personal interests?',
            answer: "Maybe! The library covers a wide range of topics, and we add more based on what people find useful. Try searching for what interests you, and if you don't see what you're looking for, let the staff know."
        },
        {
            question: 'Where does the content in these libraries come from?',
            answer: 'UnlockEd offers access to free educational materials available online. These resources are created by various organizations and individuals. Descriptions of the content from many libraries can be found within UnlockEd.'
        },
        {
            question: 'Where do the videos come from?',
            answer: "Videos come from platforms like YouTube and other free educational sources. They're made by different organizations and individuals. Check the video descriptions or the beginning of the video for more details."
        },
        {
            question: 'How is content organized in UnlockEd?',
            answer: 'UnlockEd organizes content into categories, making it easier to find related materials. You can also search by keywords or browse featured and popular content.'
        },
        {
            question:
                "What's the difference between featured content, popular content, and your top content?",
            answer: 'Featured content includes resources that staff have picked as useful. Popular content is what other residents are using the most. Your top content is what you use most.'
        },
        {
            question: "I can't find what I am searching for. What should I do?",
            answer: "Try using different keywords or checking related topics. Try searching within a particular library that you think might be related. If you still can't find what you're looking for, ask the staff -- they may be able to help you find something or request new content if it's not there."
        },
        {
            question: 'Can I save content to watch or use later?',
            answer: 'Yep! Click on the favorites icon (shaped like a star) to keep track of content you like.'
        },
        {
            question: 'How can I request new content for UnlockEd?',
            answer: "Let the staff know! We can't promise everything, but we're always looking for useful additions."
        }
    ],
    'Managing My Account': [
        {
            question: 'Can I change my name or username?',
            answer: 'Talk to the staff and they can help you.'
        },
        {
            question: 'How do I reset my password?',
            answer: 'Talk to the staff and they can help you.'
        },
        {
            question: 'Does UnlockEd have a way to track my progress?',
            answer: "Right now, UnlockEd is a library of resources you can explore freely. Some of these resources may have more of a learning path built into them, but the tool doesn't guide you along or track your progress like some other courses do. We're considering ways to help users track their learning in the future. We're always eager to hear what you'd find useful, so please let us know!"
        },
        {
            question: 'Is my activity on UnlockEd private?',
            answer: 'The UnlockEd team and authorized facility staff can see this information.'
        }
    ],
    'Getting Help and Troubleshooting': [
        {
            question: 'Can I use UnlockEd more often?',
            answer: "We're excited you'd want to use it even more! Please share this request and positive feedback with the staff. They're collecting all of it as input for the future plans."
        },
        {
            question: 'If I need more help, what do I do?',
            answer: "Ask the staff. If they can't help, they'll reach out to the UnlockEd team."
        },
        {
            question: "What should I do if something isn't working?",
            answer: "Let the staff know, and they'll report the issue!"
        },
        {
            question: 'How can I share ideas to improve UnlockEd?',
            answer: "We want to hear from you! If you have ideas, suggestions, or things you'd like to change, please share them with the staff, and they'll get passed along to the UnlockEd team."
        },
        {
            question: "What's next for UnlockEd?",
            answer: "We're always improving what we offer based on what people find helpful. For the Knowledge Center, we will continue to add valuable content and make it easy to find and use those resources. We're also exploring other offerings that would help residents access courses and track the programs they've completed. We would love to know what's valuable to you!"
        }
    ]
};

function logQuestionClick(question: string) {
    void API.post('analytics/faq-click', { question }).catch(() => {
        // Analytics failures are intentionally ignored
    });
}

export function FAQContent() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">
                Frequently Asked Questions
            </h2>
            {Object.entries(FAQ_CATEGORIES).map(
                ([category, questions]) => (
                    <div key={category}>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
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
