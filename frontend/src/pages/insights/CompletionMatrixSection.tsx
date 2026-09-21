import useSWR from 'swr';
import { ProgramCompletionMatrixCell, ServerResponseMany } from '@/types';
import {
    ProgramMatrixTable,
    LegendSwatch,
    AllTimeBadge,
    SectionError,
    UpdatingBadge
} from './ProgramMatrixTable';

interface CompletionMatrixSectionProps {
    selectedFacility: string;
}

function matrixHighlight(cells: ProgramCompletionMatrixCell[]): string | null {
    const valid = cells.filter((c) => !c.insufficient);
    if (valid.length === 0) return null;
    const best = valid.reduce((a, b) =>
        b.delta_from_facility_average > a.delta_from_facility_average ? b : a
    );
    const worst = valid.reduce((a, b) =>
        b.delta_from_facility_average < a.delta_from_facility_average ? b : a
    );
    const parts: string[] = [];
    if (best.delta_from_facility_average > 0) {
        parts.push(
            `${best.facility_name} — ${best.program_name} is the strongest outperformer (+${Math.round(best.delta_from_facility_average)}pp vs facility avg)`
        );
    }
    if (worst.delta_from_facility_average < 0 && worst !== best) {
        parts.push(
            `${worst.facility_name} — ${worst.program_name} is the largest underperformer (${Math.round(worst.delta_from_facility_average)}pp)`
        );
    }
    return parts.length > 0 ? `${parts.join('. ')}.` : null;
}

export function CompletionMatrixSection({
    selectedFacility
}: CompletionMatrixSectionProps) {
    const {
        data: matrixResp,
        error,
        isValidating
    } = useSWR<ServerResponseMany<ProgramCompletionMatrixCell>, Error>(
        `/api/department-metrics/programs/completion-matrix?facility=${selectedFacility}`
    );

    if (error) {
        return <SectionError label="the completion matrix" />;
    }

    if (!matrixResp?.data || matrixResp.data.length === 0) {
        return null;
    }

    return (
        <div
            className={`bg-card rounded-lg border border-border overflow-hidden transition-opacity ${isValidating ? 'opacity-60' : ''}`}
        >
            <div className="px-6 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-brand-dark dark:text-white font-medium">
                        Facility × Program Completion Matrix
                    </h3>
                    <div className="flex items-center gap-3">
                        <UpdatingBadge show={isValidating} />
                        <AllTimeBadge />
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    {matrixHighlight(matrixResp.data) ??
                        "Completion rate per program, colored by delta from that facility's own average. Cells with fewer than 3 enrollees are marked insufficient data."}
                </p>
            </div>
            <ProgramMatrixTable cells={matrixResp.data} />
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-6 pb-5 text-xs text-muted-foreground">
                <LegendSwatch
                    className="bg-green-100 dark:bg-green-900/30"
                    label="+15pp+"
                />
                <LegendSwatch
                    className="bg-green-50 dark:bg-green-900/15"
                    label="+5-15pp"
                />
                <LegendSwatch
                    className="bg-red-50 dark:bg-red-900/15"
                    label="-5-15pp"
                />
                <LegendSwatch
                    className="bg-red-100 dark:bg-red-900/30"
                    label="-15pp+"
                />
                <LegendSwatch className="bg-muted" label="n<3" />
            </div>
        </div>
    );
}
