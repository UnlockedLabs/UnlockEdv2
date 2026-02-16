import { forwardRef, useState, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import useSWR from 'swr';
import {
    ReportType,
    Facility,
    User,
    ProgramType,
    FundingType,
    ServerResponseMany
} from '@/common';
import { getReportConfig, ReportContextData } from './reportConfigs';
import { generateReport } from '@/api/api';
import {
    CloseX,
    DateInput,
    DropdownInput,
    CheckboxGroupInput,
    SubmitButton,
    CancelButton
} from '../inputs';

const PROGRAM_TYPE_OPTIONS = [
    { id: ProgramType.EDUCATIONAL, name: 'Educational' },
    { id: ProgramType.LIFE_SKILLS, name: 'Life Skills' },
    { id: ProgramType.MENTAL_HEALTH, name: 'Mental Health/Behavioral' },
    { id: ProgramType.RELIGIOUS, name: 'Religious/Faith-Based' },
    { id: ProgramType.RE_ENTRY, name: 'Re-Entry' },
    { id: ProgramType.THERAPEUTIC, name: 'Therapeutic' },
    { id: ProgramType.VOCATIONAL, name: 'Vocational' }
];

const FUNDING_TYPE_OPTIONS = [
    { id: FundingType.EDUCATIONAL_GRANTS, name: 'Educational Grants' },
    { id: FundingType.FEDERAL_GRANTS, name: 'Federal Grants' },
    { id: FundingType.INMATE_WELFARE, name: 'Inmate Welfare Funds' },
    {
        id: FundingType.NON_PROFIT_ORGANIZATION,
        name: 'Nonprofit Organizations'
    },
    { id: FundingType.STATE_GRANTS, name: 'State Grants' },
    { id: FundingType.OTHER, name: 'Other' }
];

interface ReportExportModalProps {
    reportType: ReportType;
    contextData: ReportContextData;
    user: User;
}

interface ReportFormData {
    start_date: string;
    end_date: string;
    format: string;
    class_status?: string;
    facility_ids?: number[];
    program_types?: string[];
    funding_types?: string[];
    user_id?: string;
}

export const ReportExportModal = forwardRef<
    HTMLDialogElement,
    ReportExportModalProps
>(function ReportExportModal({ reportType, contextData, user }, ref) {
    const config = useMemo(() => getReportConfig(reportType), [reportType]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [residentSearch, setResidentSearch] = useState('');
    const [selectedResident, setSelectedResident] = useState<User | null>(null);
    const [showResidentDropdown, setShowResidentDropdown] = useState(false);

    const { data: residentsData } = useSWR<ServerResponseMany<User>>(
        reportType === ReportType.ATTENDANCE && residentSearch.length >= 2
            ? `/api/users?role=student&per_page=20&search=${encodeURIComponent(residentSearch)}${contextData.classId ? `&class_id=${contextData.classId}&include=only_enrolled` : ''}`
            : null
    );
    const searchResults = residentsData?.data ?? [];

    const {
        register,
        handleSubmit,
        reset,
        watch,
        control,
        formState: { errors }
    } = useForm<ReportFormData>({
        defaultValues: config.getDefaultValues(
            contextData
        ) as unknown as ReportFormData
    });

    const startDate = watch('start_date');
    const endDate = watch('end_date');

    const validateDateRange = (): string | true => {
        if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
            return 'End date must be on or after start date';
        }
        return true;
    };

    const validateFacilityCount = (
        value: (string | number)[] | undefined
    ): string | true => {
        if (reportType === ReportType.FACILITY_COMPARISON) {
            if (!value || value.length < 2) {
                return 'Please select at least 2 facilities to compare';
            }
        }
        return true;
    };

    const onSubmit: SubmitHandler<ReportFormData> = async (formValues) => {
        setError(null);
        setIsGenerating(true);

        try {
            const formWithResident = {
                ...formValues,
                user_id: selectedResident?.id?.toString()
            };
            const request = config.buildRequest(
                formWithResident as unknown as Record<string, unknown>,
                contextData
            );
            const { blob, filename } = await generateReport(request);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setIsGenerating(false);
            if (ref && typeof ref !== 'function' && ref.current) {
                ref.current.close();
            }
        } catch (err) {
            setIsGenerating(false);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to generate report. Please try again.'
            );
        }
    };

    const handleRetry = () => {
        setError(null);
        void handleSubmit(onSubmit)();
    };

    const handleClose = () => {
        if (!isGenerating) {
            setError(null);
            setResidentSearch('');
            setSelectedResident(null);
            setShowResidentDropdown(false);
            reset();
            if (ref && typeof ref !== 'function' && ref.current) {
                ref.current.close();
            }
        }
    };

    return (
        <dialog ref={ref} className="modal">
            <div className="modal-box max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{config.title}</h3>
                    {!isGenerating && <CloseX close={handleClose} />}
                </div>

                <form
                    onSubmit={(e) => {
                        void handleSubmit(onSubmit)(e);
                    }}
                    className="space-y-4"
                >
                    <DateInput
                        label="Start Date"
                        interfaceRef="start_date"
                        required={true}
                        allowPastDate={true}
                        register={register}
                        errors={errors}
                        disabled={isGenerating}
                    />

                    <DateInput
                        label="End Date"
                        interfaceRef="end_date"
                        required={true}
                        allowPastDate={true}
                        register={register}
                        errors={errors}
                        disabled={isGenerating}
                        onChange={() => {
                            const validationResult = validateDateRange();
                            if (validationResult !== true) {
                                setError(validationResult);
                            } else {
                                setError(null);
                            }
                        }}
                    />

                    {reportType === ReportType.ATTENDANCE && (
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">
                                    Resident (Optional)
                                </span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by name or DOC ID..."
                                    className="input input-bordered w-full"
                                    value={
                                        selectedResident
                                            ? `${selectedResident.name_last}, ${selectedResident.name_first} (${selectedResident.doc_id ?? 'N/A'})`
                                            : residentSearch
                                    }
                                    onChange={(e) => {
                                        setResidentSearch(e.target.value);
                                        setSelectedResident(null);
                                        setShowResidentDropdown(true);
                                    }}
                                    onFocus={() =>
                                        setShowResidentDropdown(true)
                                    }
                                    disabled={isGenerating}
                                />
                                {selectedResident && (
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
                                        onClick={() => {
                                            setSelectedResident(null);
                                            setResidentSearch('');
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                                {showResidentDropdown &&
                                    residentSearch.length >= 2 &&
                                    searchResults.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-box mt-1 max-h-48 overflow-y-auto shadow-lg">
                                            {searchResults.map((resident) => (
                                                <li key={resident.id}>
                                                    <button
                                                        type="button"
                                                        className="w-full px-4 py-2 text-left hover:bg-base-200"
                                                        onClick={() => {
                                                            setSelectedResident(
                                                                resident
                                                            );
                                                            setResidentSearch(
                                                                ''
                                                            );
                                                            setShowResidentDropdown(
                                                                false
                                                            );
                                                        }}
                                                    >
                                                        {resident.name_last},{' '}
                                                        {resident.name_first} (
                                                        {resident.doc_id ??
                                                            'N/A'}
                                                        )
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                {showResidentDropdown &&
                                    residentSearch.length >= 2 &&
                                    searchResults.length === 0 && (
                                        <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-box mt-1 px-4 py-2 text-sm text-gray-500">
                                            No residents found
                                        </div>
                                    )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Type at least 2 characters to search. Leave
                                empty for all residents.
                            </p>
                        </div>
                    )}

                    <DropdownInput
                        label="Format"
                        interfaceRef="format"
                        required={true}
                        register={register}
                        errors={errors}
                        enumType={{
                            CSV: 'csv',
                            PDF: 'pdf',
                            Excel: 'excel'
                        }}
                        disabled={isGenerating}
                    />

                    {config.fields.some((f) => f.name === 'class_status') && (
                        <DropdownInput
                            label="Class Status"
                            interfaceRef="class_status"
                            required={true}
                            register={register}
                            errors={errors}
                            enumType={{
                                Active: 'Active',
                                'Not Active': 'Not Active',
                                All: 'All'
                            }}
                            disabled={isGenerating}
                        />
                    )}

                    {reportType === ReportType.FACILITY_COMPARISON && (
                        <CheckboxGroupInput
                            label="Facilities to Compare"
                            interfaceRef="facility_ids"
                            required={true}
                            control={control}
                            errors={errors}
                            validate={validateFacilityCount}
                            options={
                                user.facilities?.map((f: Facility) => ({
                                    id: f.id,
                                    name: f.name
                                })) ?? []
                            }
                            disabled={isGenerating}
                            showSelectAll
                        />
                    )}

                    {config.fields.some((f) => f.name === 'program_types') && (
                        <CheckboxGroupInput
                            label="Program Types (Optional)"
                            interfaceRef="program_types"
                            required={false}
                            control={control}
                            errors={errors}
                            options={PROGRAM_TYPE_OPTIONS}
                            disabled={isGenerating}
                            columns={2}
                        />
                    )}

                    {config.fields.some((f) => f.name === 'funding_types') && (
                        <CheckboxGroupInput
                            label="Funding Types (Optional)"
                            interfaceRef="funding_types"
                            required={false}
                            control={control}
                            errors={errors}
                            options={FUNDING_TYPE_OPTIONS}
                            disabled={isGenerating}
                            columns={2}
                        />
                    )}

                    {error && (
                        <div className="flex flex-col gap-2">
                            <p className="text-error text-sm">{error}</p>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="button button-sm self-start"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <CancelButton
                            onClick={handleClose}
                            disabled={isGenerating}
                        />
                        <SubmitButton
                            isEnabled={!isGenerating}
                            label={
                                isGenerating
                                    ? 'Generating Report...'
                                    : 'Generate Report'
                            }
                        />
                    </div>

                    {isGenerating && (
                        <p className="text-sm text-center text-gray-500 mt-2">
                            Please wait while your report is being generated...
                        </p>
                    )}
                </form>
            </div>
            <form method="dialog" className="modal-backdrop">
                {!isGenerating && <button onClick={handleClose}>close</button>}
            </form>
        </dialog>
    );
});
