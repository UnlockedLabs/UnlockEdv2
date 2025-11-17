import { forwardRef, useState, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { ReportType, Facility, User, ProgramType, FundingType } from '@/common';
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
}

export const ReportExportModal = forwardRef<
    HTMLDialogElement,
    ReportExportModalProps
>(function ReportExportModal({ reportType, contextData, user }, ref) {
    const config = useMemo(() => getReportConfig(reportType), [reportType]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            const request = config.buildRequest(
                formValues as unknown as Record<string, unknown>,
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
                        />
                    )}

                    {config.fields.some((f) => f.name === 'program_types') && (
                        <CheckboxGroupInput
                            label="Program Types (Optional)"
                            interfaceRef="program_types"
                            required={false}
                            control={control}
                            errors={errors}
                            options={[
                                {
                                    id: ProgramType.EDUCATIONAL,
                                    name: 'Educational'
                                },
                                {
                                    id: ProgramType.LIFE_SKILLS,
                                    name: 'Life Skills'
                                },
                                {
                                    id: ProgramType.MENTAL_HEALTH,
                                    name: 'Mental Health/Behavioral'
                                },
                                {
                                    id: ProgramType.RELIGIOUS,
                                    name: 'Religious/Faith-Based'
                                },
                                { id: ProgramType.RE_ENTRY, name: 'Re-Entry' },
                                {
                                    id: ProgramType.THERAPEUTIC,
                                    name: 'Therapeutic'
                                },
                                {
                                    id: ProgramType.VOCATIONAL,
                                    name: 'Vocational'
                                }
                            ]}
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
                            options={[
                                {
                                    id: FundingType.EDUCATIONAL_GRANTS,
                                    name: 'Educational Grants'
                                },
                                {
                                    id: FundingType.FEDERAL_GRANTS,
                                    name: 'Federal Grants'
                                },
                                {
                                    id: FundingType.INMATE_WELFARE,
                                    name: 'Inmate Welfare Funds'
                                },
                                {
                                    id: FundingType.NON_PROFIT_ORGANIZATION,
                                    name: 'Nonprofit Organizations'
                                },
                                {
                                    id: FundingType.STATE_GRANTS,
                                    name: 'State Grants'
                                },
                                { id: FundingType.OTHER, name: 'Other' }
                            ]}
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
