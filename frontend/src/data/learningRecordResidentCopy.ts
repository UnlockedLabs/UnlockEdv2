export const LEARNING_RECORD_PRINT_SHARE_FAQ = {
    question: 'What does "print or share" mean?',
    answer: 'When you save your record as a PDF, it becomes a single file — like a digital sheet of paper. You can print it out on paper, hand it to a staff member, or send it to someone, such as a case manager or a future employer. Your record stays private and is only seen by people you give it to.'
} as const;

export const LEARNING_RECORD_SAVED_HERE_FAQ = {
    question: 'Where is my record saved?',
    answer: "It's saved right here in the app. It is not shared with anyone automatically. Nothing leaves this app unless you choose to print or share it."
} as const;

/**
 * Resident data-use transparency notice, shown on the Learning Record landing
 * page (`short`) and the achievement entry form (`full`).
 *
 * FIRST DRAFT — pending Carolina's final copy. Both variants must assert the
 * same three facts, so edit them together:
 *   1. individual entries are not shared with facility staff,
 *   2. some data may be used in anonymized, aggregate form,
 *   3. nothing in that aggregate can be traced back to an individual.
 * Only the length differs between them.
 */
export const LEARNING_RECORD_PRIVACY_NOTICE = {
    short: {
        title: 'Your Learning Record is yours.',
        body: 'Individual entries are private and not shared with facility staff. Some information may be used in anonymized, aggregate form to help understand how programs are working — no one can trace this data back to you.'
    },
    full: {
        title: 'What you write here is yours.',
        body: "Facility staff won't see your individual answers. Some responses may be combined with other residents' answers, with all identifying information removed, to help understand what's working well in programs. Nothing you write can be traced back to you individually."
    }
} as const;
