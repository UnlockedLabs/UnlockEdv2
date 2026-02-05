import { forwardRef, useRef, useState, useMemo, useEffect } from 'react';
import { closeModal, RoomConflictModal, showModal } from '.';
import {
    Class,
    Program,
    RoomConflict,
    SelectedClassStatus,
    ServerResponseMany
} from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { RoomSelector } from '../inputs/RoomSelector';
import { FacilityProgramClassEvent } from '@/types/events';
import Select from 'react-select';
import { getDefaultSelectStyles } from '../helperFunctions/selectStyles';
import { CloseX, SubmitButton, CancelButton } from '../inputs';
import { RRule } from 'rrule';
import { formatDuration, timeToMinutes } from '../helperFunctions/formatting';

interface QuickCreateEventModalProps {
    slotStart: Date;
    slotEnd: Date;
    classId?: string;
    classData?: Class;
    mutate: KeyedMutator<ServerResponseMany<FacilityProgramClassEvent>>;
    handleCallback?: () => void;
}

interface SelectOption {
    value: number;
    label: string;
}

export const QuickCreateEventModal = forwardRef<
    HTMLDialogElement,
    QuickCreateEventModalProps
>(function QuickCreateEventModal(
    { slotStart, slotEnd, classId, classData, mutate, handleCallback },
    ref
) {
    const { user } = useAuth();
    if (!user) return null;

    const checkResponse = useCheckResponse({ mutate, refModal: ref });
    const conflictModalRef = useRef<HTMLDialogElement>(null);

    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const [selectedRoomName, setSelectedRoomName] = useState<string>();
    const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
        classData?.program_id ?? null
    );
    const [selectedClassId, setSelectedClassId] = useState<number | null>(
        classId ? parseInt(classId) : null
    );
    const [programs, setPrograms] = useState<Program[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [timeError, setTimeError] = useState('');

    const isAutoFill = !!classId && !!classData;

    const zonedStart = useMemo(
        () => toZonedTime(slotStart, user.timezone),
        [slotStart, user.timezone]
    );

    const slotDate = zonedStart.toISOString().split('T')[0];

    const initialStartTime = zonedStart.toTimeString().slice(0, 5);
    const initialEndTime = useMemo(() => {
        const diffMin = (slotEnd.getTime() - slotStart.getTime()) / 60000;
        const end =
            diffMin < 60 ? new Date(slotStart.getTime() + 60 * 60000) : slotEnd;
        return toZonedTime(end, user.timezone).toTimeString().slice(0, 5);
    }, [slotStart, slotEnd, user.timezone]);

    const [date, setDate] = useState(slotDate);
    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState(initialEndTime);

    useEffect(() => {
        if (isAutoFill) return;
        void (async () => {
            const resp = await API.get<Program>('programs?per_page=100');
            if (resp.success && resp.data) {
                setPrograms(resp.data as Program[]);
            }
        })();
    }, [isAutoFill]);

    useEffect(() => {
        if (isAutoFill || !selectedProgramId) {
            setClasses([]);
            return;
        }
        setSelectedClassId(null);
        void (async () => {
            const resp = await API.get<Class>(
                `programs/${selectedProgramId}/classes?per_page=100`
            );
            if (resp.success && resp.data) {
                const all = resp.data as Class[];
                setClasses(
                    all.filter(
                        (c) =>
                            c.status === SelectedClassStatus.Active ||
                            c.status === SelectedClassStatus.Scheduled
                    )
                );
            }
        })();
    }, [selectedProgramId, isAutoFill]);

    const programOptions: SelectOption[] = useMemo(
        () => programs.map((p) => ({ value: p.id, label: p.name })),
        [programs]
    );

    const classOptions: SelectOption[] = useMemo(
        () => classes.map((c) => ({ value: c.id, label: c.name })),
        [classes]
    );

    const selectStyles = getDefaultSelectStyles<SelectOption, false>();

    const handleSubmitEvent = async () => {
        setTimeError('');
        if (!selectedClassId || !selectedRoomId) return;
        if (!startTime || !endTime || !date) return;

        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
            setTimeError('End time must be after start time');
            return;
        }

        const zonedDateTime = fromZonedTime(
            `${date}T${startTime}`,
            user.timezone
        );
        const rule = new RRule({
            freq: RRule.DAILY,
            count: 1,
            dtstart: zonedDateTime
        });
        const localDtstart = `${date.replace(/-/g, '')}T${startTime.replace(':', '')}00`;
        const ruleString = rule
            .toString()
            .replace(
                /DTSTART[^:]*:[^\n]+/,
                `DTSTART;TZID=${user.timezone}:${localDtstart}`
            );
        const duration = formatDuration(startTime, endTime);

        const response = await API.post(
            `program-classes/${selectedClassId}/events`,
            {
                recurrence_rule: ruleString,
                duration,
                room_id: selectedRoomId
            }
        );

        if (!response.success && response.status === 409) {
            const data = response.data as RoomConflict[];
            if (Array.isArray(data) && data.length > 0) {
                setConflicts(data);
                showModal(conflictModalRef);
                return;
            }
        }

        checkResponse(
            response.success,
            'Failed to create event',
            'Event created successfully'
        );
        if (response.success) handleCallback?.();
    };

    const handleClose = () => {
        setDate(slotDate);
        setStartTime(initialStartTime);
        setEndTime(initialEndTime);
        setSelectedRoomId(null);
        setSelectedRoomName(undefined);
        setConflicts([]);
        setTimeError('');
        if (!isAutoFill) {
            setSelectedProgramId(null);
            setSelectedClassId(null);
        }
        closeModal(ref);
    };

    const canSubmit =
        !!selectedClassId &&
        !!selectedRoomId &&
        !!date &&
        !!startTime &&
        !!endTime;

    return (
        <>
            <dialog ref={ref} className="modal" onClose={handleClose}>
                <div className="modal-box">
                    <CloseX close={handleClose} />
                    <span className="text-3xl font-semibold pb-6 text-neutral block">
                        Quick Create Event
                    </span>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleSubmitEvent();
                        }}
                        className="space-y-4"
                    >
                        {isAutoFill ? (
                            <div className="space-y-1">
                                <p className="body">
                                    <span className="font-semibold">
                                        Program:
                                    </span>{' '}
                                    {classData.program?.name}
                                </p>
                                <p className="body">
                                    <span className="font-semibold">
                                        Class:
                                    </span>{' '}
                                    {classData.name}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="label label-text">
                                        Program
                                    </label>
                                    <Select
                                        options={programOptions}
                                        placeholder="Select program..."
                                        styles={selectStyles}
                                        classNamePrefix="react-select"
                                        value={
                                            programOptions.find(
                                                (o) =>
                                                    o.value ===
                                                    selectedProgramId
                                            ) ?? null
                                        }
                                        onChange={(s) =>
                                            setSelectedProgramId(
                                                s?.value ?? null
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="label label-text">
                                        Class
                                    </label>
                                    <Select
                                        options={classOptions}
                                        placeholder={
                                            selectedProgramId
                                                ? 'Select class...'
                                                : 'Select a program first'
                                        }
                                        styles={selectStyles}
                                        classNamePrefix="react-select"
                                        isDisabled={!selectedProgramId}
                                        value={
                                            classOptions.find(
                                                (o) =>
                                                    o.value === selectedClassId
                                            ) ?? null
                                        }
                                        onChange={(s) =>
                                            setSelectedClassId(s?.value ?? null)
                                        }
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="label label-text">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="input input-bordered w-full"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label label-text">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => {
                                        setStartTime(e.target.value);
                                        setTimeError('');
                                    }}
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label label-text">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => {
                                        setEndTime(e.target.value);
                                        setTimeError('');
                                    }}
                                    className="input input-bordered w-full"
                                    required
                                />
                                {timeError && (
                                    <div className="text-error text-sm">
                                        {timeError}
                                    </div>
                                )}
                            </div>
                        </div>
                        <RoomSelector
                            label="Room"
                            value={selectedRoomId}
                            onChange={(id, name) => {
                                setSelectedRoomId(id);
                                setSelectedRoomName(name);
                            }}
                        />
                        <div className="flex justify-end gap-4 pt-4">
                            <CancelButton onClick={handleClose} />
                            <SubmitButton
                                label="Create Event"
                                isEnabled={canSubmit}
                            />
                        </div>
                    </form>
                </div>
            </dialog>
            <RoomConflictModal
                ref={conflictModalRef}
                conflicts={conflicts}
                timezone={user.timezone}
                roomName={selectedRoomName}
                onClose={() => {
                    conflictModalRef.current?.close();
                    setConflicts([]);
                }}
            />
        </>
    );
});
