import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { closeModal } from '.';
import { Program } from '@/common';
import API from '@/api/api';
import { useAuth } from '@/useAuth';
import { toZonedTime } from 'date-fns-tz';
import Select from 'react-select';
import { getDefaultSelectStyles } from '../helperFunctions/selectStyles';
import { CloseX, CancelButton } from '../inputs';
import { CalendarDaysIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

interface ScheduleActionModalProps {
    slotStart: Date;
    slotEnd: Date;
    onSingleEvent: () => void;
}

interface SelectOption {
    value: number;
    label: string;
}

export const ScheduleActionModal = forwardRef<
    HTMLDialogElement,
    ScheduleActionModalProps
>(function ScheduleActionModal({ slotStart, slotEnd, onSingleEvent }, ref) {
    const { user } = useAuth();
    if (!user) return null;

    const navigate = useNavigate();
    const [showProgramSelect, setShowProgramSelect] = useState(false);
    const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
        null
    );
    const [programs, setPrograms] = useState<Program[]>([]);

    useEffect(() => {
        if (!showProgramSelect) return;
        void (async () => {
            const resp = await API.get<Program>('programs?per_page=100');
            if (resp.success && resp.data) {
                setPrograms(resp.data as Program[]);
            }
        })();
    }, [showProgramSelect]);

    const programOptions: SelectOption[] = useMemo(
        () => programs.map((p) => ({ value: p.id, label: p.name })),
        [programs]
    );

    const selectStyles = getDefaultSelectStyles<SelectOption, false>();

    const zonedStart = useMemo(
        () => toZonedTime(slotStart, user.timezone),
        [slotStart, user.timezone]
    );

    const zonedEnd = useMemo(() => {
        const diffMin = (slotEnd.getTime() - slotStart.getTime()) / 60000;
        const end =
            diffMin < 60 ? new Date(slotStart.getTime() + 60 * 60000) : slotEnd;
        return toZonedTime(end, user.timezone);
    }, [slotStart, slotEnd, user.timezone]);

    const handleClose = () => {
        setShowProgramSelect(false);
        setSelectedProgramId(null);
        closeModal(ref);
    };

    const handleSingleEvent = () => {
        handleClose();
        onSingleEvent();
    };

    const handleNewClass = () => {
        if (!selectedProgramId) return;
        const startDate = zonedStart.toISOString().split('T')[0];
        const startTime = zonedStart.toTimeString().slice(0, 5);
        const endTime = zonedEnd.toTimeString().slice(0, 5);
        handleClose();
        navigate(`/programs/${selectedProgramId}/classes/new`, {
            state: { startDate, startTime, endTime }
        });
    };

    return (
        <dialog ref={ref} className="modal" onClose={handleClose}>
            <div className="modal-box !overflow-visible">
                <CloseX close={handleClose} />
                <span className="text-3xl font-semibold pb-6 text-neutral block">
                    Add to Schedule
                </span>
                {!showProgramSelect ? (
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={handleSingleEvent}
                            className="card border border-grey-1 p-4 flex flex-row items-center gap-4 cursor-pointer hover:bg-base-200 transition-colors text-left"
                        >
                            <CalendarDaysIcon className="h-8 w-8 text-neutral shrink-0" />
                            <div>
                                <p className="font-semibold text-neutral">
                                    Add a single event
                                </p>
                                <p className="text-sm text-grey-4">
                                    One-off session like a guest speaker or
                                    extra class
                                </p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowProgramSelect(true)}
                            className="card border border-grey-1 p-4 flex flex-row items-center gap-4 cursor-pointer hover:bg-base-200 transition-colors text-left"
                        >
                            <AcademicCapIcon className="h-8 w-8 text-neutral shrink-0" />
                            <div>
                                <p className="font-semibold text-neutral">
                                    Create a new class
                                </p>
                                <p className="text-sm text-grey-4">
                                    Set up a recurring class with full
                                    scheduling
                                </p>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="body text-neutral">
                            Select a program to create the new class under:
                        </p>
                        <Select
                            options={programOptions}
                            placeholder="Select program..."
                            styles={selectStyles}
                            classNamePrefix="react-select"
                            value={
                                programOptions.find(
                                    (o) => o.value === selectedProgramId
                                ) ?? null
                            }
                            onChange={(s) =>
                                setSelectedProgramId(s?.value ?? null)
                            }
                        />
                        <div className="flex justify-end gap-4 pt-2">
                            <CancelButton
                                onClick={() => {
                                    setShowProgramSelect(false);
                                    setSelectedProgramId(null);
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleNewClass}
                                disabled={!selectedProgramId}
                                className="button"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </dialog>
    );
});
