import type { TranscriptDraft, TranscriptEntry } from '@/types/digital-transcript';

export const TOP_SKILLS_MAX = 5;

/** Open-text reflection keys (character nudges). */
export type ReflectionTextFieldKey =
    | 'whatMadeYouFinish'
    | 'pride'
    | 'goalConnection'
    | 'standoutMoment'
    | 'adviceToPeer'
    | 'oneSentence'
    | 'topSkillsParagraph';

/** Answer fields only (metadata: programName, completionDate). */
export type ReflectionAnswerKey = keyof Pick<
    TranscriptDraft,
    | 'topSkills'
    | 'whatMadeYouFinish'
    | 'confidence'
    | 'pride'
    | 'goalConnection'
    | 'standoutMoment'
    | 'adviceToPeer'
    | 'oneSentence'
>;

export type ReflectionStepKind = 'text' | 'confidence' | 'tags';

export interface ReflectionStep {
    key: ReflectionAnswerKey;
    kind: ReflectionStepKind;
    editorLabel: string;
    previewLabel: string;
    /** Shown under the main label (e.g. Q1 tags). */
    editorSubtitle?: string;
}

/** Soft guidance for textarea nudges — never blocks save. */
export interface ReflectionTextNudge {
    maxLength: number;
    recommendedMin: number;
    recommendedMax: number;
    hint: string;
}

const FUNNEL_TEXT_NUDGE_200: ReflectionTextNudge = {
    maxLength: 200,
    recommendedMin: 0,
    recommendedMax: 200,
    hint: ''
};

export const REFLECTION_TEXT_NUDGES: Record<ReflectionTextFieldKey, ReflectionTextNudge> = {
    whatMadeYouFinish: {
        maxLength: 280,
        recommendedMin: 80,
        recommendedMax: 260,
        hint: 'A sentence or two helps your record feel complete.'
    },
    pride: {
        maxLength: 400,
        recommendedMin: 120,
        recommendedMax: 380,
        hint: 'Specific examples make your achievement memorable.'
    },
    goalConnection: {
        maxLength: 280,
        recommendedMin: 70,
        recommendedMax: 260,
        hint: 'Linking this program to your next step shows momentum.'
    },
    standoutMoment: {
        maxLength: 400,
        recommendedMin: 100,
        recommendedMax: 380,
        hint: 'A short story here helps readers connect with your experience.'
    },
    adviceToPeer: {
        maxLength: 200,
        recommendedMin: 50,
        recommendedMax: 180,
        hint: 'Even one honest line can encourage someone else.'
    },
    oneSentence: {
        maxLength: 150,
        recommendedMin: 60,
        recommendedMax: 140,
        hint: 'This line becomes the headline on your record card.'
    },
    topSkillsParagraph: FUNNEL_TEXT_NUDGE_200
};

/** Live document preview — section labels (layout order is handled in the preview component). */
export const DOCUMENT_PREVIEW_LABELS = {
    program: 'Program',
    completed: 'Completed',
    confidence: 'Confidence in future',
    skills: 'Skills gained',
    headline: 'Your headline',
    pride: "Why I'm proud of it",
    standout: 'A moment that stood out',
    finish: 'What made me finish',
    connects: 'Connects to',
    advice: "What I'd tell another resident"
} as const;

/** Achievements record preview — matches finalized Learning Record document. */
export const LEARNING_RECORD_PREVIEW_LABELS = {
    program: 'Program',
    completed: 'Completed',
    confidence: 'Confidence in future',
    skills: 'Top skills',
    pride: "Why I'm proud of it",
    standout: 'A moment that stood out',
    finish: 'What made me finish',
    connects: 'Connects to'
} as const;

export const TOP_SKILLS_CAP_MESSAGE =
    '5 top skills max. Remove one to add another.';

/**
 * Finalized Learning Record reflection questions — single source of truth for
 * editor order and copy (WYSIWYG flow).
 */
export const REFLECTION_STEPS: readonly ReflectionStep[] = [
    {
        key: 'topSkills',
        kind: 'tags',
        editorLabel: 'What new skill or knowledge did this program give you?',
        editorSubtitle:
            'These are your top skills from this program. Choose up to 5.',
        previewLabel: 'Skills gained'
    },
    {
        key: 'whatMadeYouFinish',
        kind: 'text',
        editorLabel: 'What made you finish it?',
        previewLabel: 'What made you finish it?'
    },
    {
        key: 'confidence',
        kind: 'confidence',
        editorLabel:
            'How confident do you feel about your future since completing this program?',
        previewLabel:
            'How confident do you feel about your future since completing this program?'
    },
    {
        key: 'pride',
        kind: 'text',
        editorLabel: 'Why are you proud of it?',
        previewLabel: 'Why are you proud of it?'
    },
    {
        key: 'goalConnection',
        kind: 'text',
        editorLabel:
            "What does this connect to for a goal, job, or career you're working toward now or in the future?",
        previewLabel:
            "What does this connect to for a goal, job, or career you're working toward now or in the future?"
    },
    {
        key: 'standoutMoment',
        kind: 'text',
        editorLabel: 'Was there a moment or someone from this program that stood out for you?',
        previewLabel: 'Was there a moment or someone from this program that stood out for you?'
    },
    {
        key: 'adviceToPeer',
        kind: 'text',
        editorLabel: "What's one thing you'd tell another resident about this program?",
        previewLabel: "What's one thing you'd tell another resident about this program?"
    },
    {
        key: 'oneSentence',
        kind: 'text',
        editorLabel: 'How would you explain this program in one sentence?',
        previewLabel: 'How would you explain this program in one sentence?'
    }
] as const;

export function reflectionStepByKey(key: ReflectionAnswerKey): ReflectionStep | undefined {
    return REFLECTION_STEPS.find((s) => s.key === key);
}

/** Funnel prototype — flat editor order (metadata is separate in the form). */
export const REFLECTION_STEPS_FUNNEL_ORDER: readonly ReflectionAnswerKey[] = [
    'topSkills',
    'whatMadeYouFinish',
    'confidence',
    'pride',
    'goalConnection',
    'standoutMoment',
    'adviceToPeer',
    'oneSentence'
] as const;

/** Funnel stepped form — field keys per section (metadata keys on step 0 only). */
export type FunnelStepField =
    | 'programName'
    | 'completionDate'
    | ReflectionAnswerKey;

export interface FunnelFormStepConfig {
    id: string;
    title: string;
    fields: readonly FunnelStepField[];
}

export const FUNNEL_FORM_STEPS: readonly FunnelFormStepConfig[] = [
    {
        id: 'achievement',
        title: 'My Achievement',
        fields: ['programName', 'completionDate', 'oneSentence', 'whatMadeYouFinish']
    },
    {
        id: 'experience',
        title: 'My Experience',
        fields: ['pride', 'standoutMoment', 'adviceToPeer']
    },
    {
        id: 'future',
        title: 'My Future',
        fields: ['confidence', 'topSkills', 'goalConnection']
    }
] as const;

export const FUNNEL_FORM_STEP_COUNT = FUNNEL_FORM_STEPS.length;

/** Funnel live preview — first-person captions above each answer. */
export const FUNNEL_PREVIEW_LABELS: Record<ReflectionAnswerKey, string> = {
    oneSentence: 'In my own words',
    whatMadeYouFinish: 'What kept me going',
    pride: 'How it changed me',
    standoutMoment: 'A moment that stood out for me',
    adviceToPeer: "What I'd tell others",
    confidence: 'My confidence in the future',
    topSkills: 'Skills I gained',
    goalConnection: 'Where this leads for me'
};

/** Funnel form — helper text below question label, above input. */
export const FUNNEL_FIELD_DESCRIPTIONS: Record<ReflectionAnswerKey, string> = {
    oneSentence:
        'Sum it up in your own words — this becomes the first thing someone reads about your achievement.',
    whatMadeYouFinish: 'Think about what drove you to keep going, even when it was hard.',
    pride: 'Reflect on any shift in your confidence, attitude, or how you relate to the people around you.',
    standoutMoment:
        'A specific memory or person makes your record more personal and memorable.',
    adviceToPeer: 'Your honest take could help someone else decide to take this step.',
    confidence: 'Choose on a scale of 1 to 5, where 5 means you feel most confident.',
    topSkills: 'List the skills or knowledge you walked away with — even small ones count.',
    goalConnection: 'Connecting this program to a goal shows momentum and intention.'
};

export interface FunnelPreviewSection {
    id: string;
    title: string;
    fields: readonly ReflectionAnswerKey[];
}

/** Funnel preview — reflection fields grouped by form section (metadata excluded). */
export const FUNNEL_PREVIEW_SECTIONS: readonly FunnelPreviewSection[] = FUNNEL_FORM_STEPS.map(
    (step) => ({
        id: step.id,
        title: step.title,
        fields: step.fields.filter(
            (f): f is ReflectionAnswerKey => f !== 'programName' && f !== 'completionDate'
        )
    })
);

/** Funnel editor — 200-char limits for all paragraph fields. */
export const FUNNEL_REFLECTION_TEXT_NUDGES: Record<
    Exclude<ReflectionTextFieldKey, 'topSkillsParagraph'> | 'topSkillsParagraph',
    ReflectionTextNudge
> = {
    oneSentence: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.oneSentence
    },
    whatMadeYouFinish: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.whatMadeYouFinish
    },
    pride: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.pride
    },
    standoutMoment: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.standoutMoment
    },
    adviceToPeer: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.adviceToPeer
    },
    goalConnection: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.goalConnection
    },
    topSkillsParagraph: {
        ...FUNNEL_TEXT_NUDGE_200,
        hint: FUNNEL_FIELD_DESCRIPTIONS.topSkills
    }
};

export function funnelStepFieldLabel(field: FunnelStepField): string {
    switch (field) {
        case 'programName':
            return 'Program name';
        case 'completionDate':
            return 'Completion date';
        case 'oneSentence':
            return 'How would you explain this program in one sentence?';
        case 'whatMadeYouFinish':
            return 'What made you finish it?';
        case 'pride':
            return 'How has completing this changed how you feel about yourself or how you show up for others?';
        case 'standoutMoment':
            return 'Was there a moment or someone from this program that stood out for you?';
        case 'adviceToPeer':
            return "What's one thing you'd tell another resident about this program?";
        case 'confidence':
            return 'How confident do you feel about your future since completing this program?';
        case 'topSkills':
            return 'What new skill or knowledge did this program give you?';
        case 'goalConnection':
            return "What does this connect to for a goal, job, or career you're working toward?";
        default:
            return '';
    }
}

function funnelFieldAnswered(entry: TranscriptEntry, field: FunnelStepField): boolean {
    if (field === 'programName') return Boolean(entry.programName.trim());
    if (field === 'completionDate') return Boolean(entry.completionDate.trim());
    if (field === 'confidence') return /^[1-5]$/.test(entry.confidence.trim());
    if (field === 'topSkills') {
        return entry.topSkills.length > 0 && Boolean(entry.topSkills[0]?.trim());
    }
    return Boolean(entry[field].trim());
}

/** Whether a funnel reflection field has a non-empty answer (preview visibility). */
export function funnelReflectionFieldAnswered(
    entry: TranscriptEntry,
    key: ReflectionAnswerKey
): boolean {
    return funnelFieldAnswered(entry, key);
}

/** True when every field in the funnel step has a non-empty answer. */
export function isFunnelStepComplete(stepIndex: number, entry: TranscriptEntry): boolean {
    const step = FUNNEL_FORM_STEPS[stepIndex];
    if (!step) return false;
    return step.fields.every((field) => funnelFieldAnswered(entry, field));
}

export const FUNNEL_FORM_FIELD_TOTAL = FUNNEL_FORM_STEPS.reduce(
    (sum, step) => sum + step.fields.length,
    0
);

export function countFunnelStepFieldsAnswered(
    stepIndex: number,
    entry: TranscriptEntry
): number {
    const step = FUNNEL_FORM_STEPS[stepIndex];
    if (!step) return 0;
    return step.fields.filter((field) => funnelFieldAnswered(entry, field)).length;
}

export function countFunnelFieldsAnswered(entry: TranscriptEntry): number {
    return FUNNEL_FORM_STEPS.reduce(
        (sum, _, index) => sum + countFunnelStepFieldsAnswered(index, entry),
        0
    );
}

/** Maps answered count to tiers 1–5; 10 fields → one tier per 2 answers. */
export function funnelCompletionTier(answered: number, total: number): number {
    if (total <= 0) return 1;
    return Math.min(5, Math.max(1, Math.ceil(answered / (total / 5))));
}

export interface ReflectionCategorySection {
    id: string;
    title: string;
    description: string;
    stepKeys: readonly ReflectionAnswerKey[];
}

/** Categories prototype — grouped sections (metadata is separate in the form). */
export const REFLECTION_CATEGORIES: readonly ReflectionCategorySection[] = [
    {
        id: 'practical-future',
        title: 'Your practical future',
        description:
            'Skills, confidence, and how this program connects to what you want next.',
        stepKeys: ['topSkills', 'confidence', 'goalConnection']
    },
    {
        id: 'you-as-a-person',
        title: 'You as a person',
        description:
            "What you're proud of, what stood out, and what you'd share with another resident.",
        stepKeys: ['pride', 'standoutMoment', 'adviceToPeer', 'whatMadeYouFinish']
    },
    {
        id: 'in-summary',
        title: 'In summary',
        description: 'One sentence that captures the program for your learning record.',
        stepKeys: ['oneSentence']
    }
] as const;

export const REFLECTION_CATEGORY_SECTION_TOTAL = REFLECTION_CATEGORIES.length;

/** 1–5 scale labels (confidence) — shared by editor, preview, and a11y. */
export const CONFIDENCE_RADIO_OPTIONS = [
    ['1', 'Not at all confident'],
    ['2', 'A little confident'],
    ['3', 'Somewhat confident'],
    ['4', 'Confident'],
    ['5', 'Very confident']
] as const;

export function confidenceScaleLabel(value: string): string {
    if (!/^[1-5]$/.test(value)) return value.trim() || '';
    const row = CONFIDENCE_RADIO_OPTIONS.find(([v]) => v === value);
    return row ? `${value} — ${row[1]}` : value;
}

export type NudgeTone = 'short' | 'building' | 'neutral' | 'strong';

/**
 * Visual tone for character nudges (track + counter emphasis).
 * Never used to block input.
 */
export function getReflectionNudgeTone(
    length: number,
    nudge: ReflectionTextNudge
): NudgeTone {
    if (length === 0) return 'neutral';
    if (length < nudge.recommendedMin * 0.25) return 'short';
    if (length < nudge.recommendedMin) return 'building';
    if (length >= nudge.recommendedMin && length <= nudge.recommendedMax) return 'neutral';
    return 'strong';
}

export function nudgeTrackFillRatio(length: number, nudge: ReflectionTextNudge): number {
    if (nudge.maxLength <= 0) return 0;
    return Math.min(1, length / nudge.recommendedMax);
}

export const NUDGE_TONE_CLASSES: Record<
    NudgeTone,
    { track: string; trackBg: string; counter: string }
> = {
    short: {
        track: 'bg-destructive/80',
        trackBg: 'bg-destructive/15',
        counter: 'text-destructive'
    },
    building: {
        track: 'bg-amber-500/90',
        trackBg: 'bg-amber-500/20',
        counter: 'text-amber-700 dark:text-amber-400'
    },
    neutral: {
        track: 'bg-muted-foreground/50',
        trackBg: 'bg-muted/80',
        counter: 'text-muted-foreground'
    },
    strong: {
        track: 'bg-emerald-600/85 dark:bg-emerald-500/80',
        trackBg: 'bg-emerald-600/15 dark:bg-emerald-500/15',
        counter: 'text-emerald-800 dark:text-emerald-400'
    }
};
