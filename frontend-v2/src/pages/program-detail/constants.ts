import { ProgramType, CreditType, FundingType, ProgramEffectiveStatus } from '@/types';

export type SortOption =
    | 'name-asc'
    | 'name-desc'
    | 'enrollment-asc'
    | 'enrollment-desc'
    | 'completion-asc'
    | 'completion-desc';

export const programTypeColors: Record<string, string> = {
    Educational: 'bg-blue-100 text-blue-700 border-blue-200',
    Vocational: 'bg-orange-100 text-orange-700 border-orange-200',
    Mental_Health_Behavioral: 'bg-pink-100 text-pink-700 border-pink-200',
    Therapeutic: 'bg-purple-100 text-purple-700 border-purple-200',
    Life_Skills: 'bg-green-100 text-green-700 border-green-200',
    'Re-Entry': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Religious_Faith-Based': 'bg-amber-100 text-amber-700 border-amber-200'
};

export const statusColors: Record<ProgramEffectiveStatus, string> = {
    [ProgramEffectiveStatus.Available]:
        'bg-green-100 text-green-700 border-green-300',
    [ProgramEffectiveStatus.Inactive]:
        'bg-gray-100 text-gray-700 border-gray-300',
    [ProgramEffectiveStatus.Archived]: 'bg-red-100 text-red-700 border-red-300'
};

export const ALL_PROGRAM_TYPES: ProgramType[] = [
    ProgramType.EDUCATIONAL,
    ProgramType.VOCATIONAL,
    ProgramType.MENTAL_HEALTH,
    ProgramType.THERAPEUTIC,
    ProgramType.LIFE_SKILLS,
    ProgramType.RE_ENTRY,
    ProgramType.RELIGIOUS
];

export const ALL_CREDIT_TYPES: CreditType[] = [
    CreditType.COMPLETION,
    CreditType.EARNED_TIME,
    CreditType.EDUCATION,
    CreditType.PARTICIPATION
];

export const ALL_FUNDING_TYPES: FundingType[] = [
    FundingType.EDUCATIONAL_GRANTS,
    FundingType.FEDERAL_GRANTS,
    FundingType.INMATE_WELFARE,
    FundingType.NON_PROFIT_ORGANIZATION,
    FundingType.STATE_GRANTS,
    FundingType.OTHER
];

export const TAB_TRIGGER_CLASSES =
    'data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-[#203622] data-[state=inactive]:hover:bg-gray-50 px-[15px] py-[9px] rounded-lg transition-all duration-200';
