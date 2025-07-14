import { useState } from 'react';
import { OverrideForm } from '@/common';
import { Event } from '@/types/events';
import API from '@/api/api';

export interface ClassEventProps {
    event: Event;
    onClose: () => void;
}

export interface EditEventForm {
    date: string;
    start_time: string;
    duration_unit?: string;
    duration?: number | string;
    location?: string;
    is_cancelled?: boolean;
    override_type: string;
}

function EditEventForm({ event, onClose }: ClassEventProps) {
    const [showApplyChanges, setShowApplyChanges] = useState(false);
    const [form, setForm] = useState<EditEventForm>({
        date: event.start_time.split('T')[0],
        location: '',
        is_cancelled: event.is_cancelled,
        duration: '',
        duration_unit: ''
    } as EditEventForm);

    const handleInputChange = (
        field: string,
        value: string | number | boolean | string[]
    ): void => {
        setForm((prevForm) => ({
            ...prevForm,
            [field]: value
        }));
    };

    const handleSaveChanges = (cancel: boolean) => {
        if (cancel) {
            setForm((prevForm) => ({
                ...prevForm,
                is_cancelled: true
            }));
        }
        setShowApplyChanges(true);
    };

    const formatDuration = () => {
        return `${form.duration}${form.duration_unit}`;
    };

    const diffForm = (form: EditEventForm, event: Event): OverrideForm => {
        const toUpdate = {} as OverrideForm;
        if (form.start_time != event.start_time) {
            toUpdate.start_time = form.start_time;
        }
        if (form.location != event.location) {
            toUpdate.location = form.location;
        }
        if (form.is_cancelled != event.is_cancelled) {
            toUpdate.is_cancelled = form.is_cancelled;
        }
        if (form.duration) {
            toUpdate.duration = formatDuration();
        }
        toUpdate.date = form.date;
        return toUpdate;
    };

    const handleSubmit = async (apply: string) => {
        const diffed = diffForm(form, event);
        diffed.override_type = apply;
        const response = await API.put(
            `program_classes/${event.class_id}/events/${event.event_id}`,
            diffed
        );
        if (response.success) {
            onClose();
        }
    };

    return (
        <div className="modal-content p-6">
            <h3 className="text-lg font-bold mb-4">{event.program_name}</h3>

            <div className="mb-4">
                <label className="block text-sm font-medium">Location</label>
                <input
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                        handleInputChange('location', e.target.value)
                    }
                    className="input input-bordered w-full"
                />
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium">
                    Start Date & Time
                </label>
                <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) =>
                        handleInputChange('start_date', e.target.value)
                    }
                    className="input input-bordered w-full"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium">Duration</label>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={form.duration}
                        onChange={(e) =>
                            handleInputChange(
                                'duration',
                                Number(e.target.value)
                            )
                        }
                        className="input input-bordered w-2/3"
                    />
                    <select
                        value={form.duration_unit}
                        onChange={(e) =>
                            handleInputChange('duration_unit', e.target.value)
                        }
                        className="select select-bordered w-1/3"
                    >
                        <option value="h">Hours</option>
                        <option value="m">Minutes</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-between mt-4">
                <button
                    className="btn btn-error"
                    onClick={() => handleSaveChanges(true)}
                >
                    Cancel Event
                </button>
                <button
                    className="button"
                    onClick={() => handleSaveChanges(false)}
                >
                    Save Changes
                </button>
            </div>
            <button
                className="absolute top-2 right-2 btn btn-sm btn-circle"
                onClick={onClose}
            >
                ✕
            </button>

            {showApplyChanges && (
                <div className="modal modal-open fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="modal-box bg-auto p-6 rounded-lg shadow-lg w-96">
                        <h3 className="text-lg font-bold mb-4">
                            Apply Changes to Recurrence
                        </h3>
                        <p className="mb-4">
                            How would you like to apply changes?
                        </p>
                        <div className="space-y-2">
                            <button
                                className="button w-full"
                                onClick={() => void handleSubmit('all')}
                            >
                                Apply to All Instances
                            </button>
                            <button
                                className="button w-full"
                                onClick={() => void handleSubmit('forward')}
                            >
                                Apply going forward
                            </button>
                            <button
                                className="btn w-full btn-primary"
                                onClick={() => void handleSubmit('self')}
                            >
                                Apply to this event only
                            </button>
                            <button
                                className="btn btn-warning w-full"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
export default EditEventForm;
