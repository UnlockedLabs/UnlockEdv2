import { useRef, useMemo } from 'react';
import { ClassEnrollment, Class, ToastState } from '@/common';
import { FormModal, FormInputTypes } from '@/Components/modals';
import { FieldValues } from 'react-hook-form';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

interface EditableEnrollmentDateProps {
    enrollment: ClassEnrollment;
    classInfo?: Class;
    onUpdate: () => void;
    disabled?: boolean;
}

export default function EditableEnrollmentDate({
    enrollment,
    classInfo,
    onUpdate,
    disabled = false
}: EditableEnrollmentDateProps) {
    const modalRef = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();

    const toDateOnly = (iso: string) => {
        const d = new Date(iso);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };

    const displayDate = enrollment.enrolled_at ?? enrollment.created_at;

    const handleDateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled) {
            modalRef.current?.showModal();
        }
    };

    const handleDateUpdate = async (formData: FieldValues) => {
        const newDate = formData.enrolled_date as string;
        const dateObj = toDateOnly(newDate + 'T00:00:00Z');

        const response = await API.patch(
            `program-classes/${enrollment.class_id}/enrollments/${enrollment.id}/date`,
            {
                enrolled_date: dateObj.toISOString()
            }
        );

        if (response.success) {
            toaster('Enrollment date updated successfully', ToastState.success);
            onUpdate();
            modalRef.current?.close();
        } else {
            const errorMessage =
                response.message || 'Failed to update enrollment date';
            toaster(errorMessage, ToastState.error);
        }
    };

    const validateEnrollmentDate = (date: string) => {
        if (!date) return 'Date is required';

        const selectedDate = toDateOnly(date + 'T00:00:00Z');
        const today = toDateOnly(new Date().toISOString());

        if (selectedDate > today) {
            return `Enrollment date cannot be in the future (today is ${today.toLocaleDateString()})`;
        }

        if (classInfo?.start_dt) {
            const classStartDate = toDateOnly(classInfo.start_dt);
            if (selectedDate < classStartDate) {
                return `Enrollment date cannot be before class start date (${classStartDate.toLocaleDateString()})`;
            }
        }

        if (classInfo?.end_dt) {
            const classEndDate = toDateOnly(classInfo.end_dt);
            if (selectedDate > classEndDate) {
                return `Enrollment date cannot be after class end date (${classEndDate.toLocaleDateString()})`;
            }
        }

        return true;
    };

    const defaultValues = useMemo(
        () => ({
            enrolled_date: enrollment.enrolled_at
                ? toDateOnly(enrollment.enrolled_at).toISOString().split('T')[0]
                : toDateOnly(enrollment.created_at).toISOString().split('T')[0]
        }),
        [enrollment.enrolled_at, enrollment.created_at]
    );

    return (
        <>
            <span
                className={`group flex items-center gap-1 cursor-pointer hover:text-primary hover:underline ${
                    disabled ? 'cursor-not-allowed opacity-50' : ''
                }`}
                onClick={handleDateClick}
                title={
                    disabled
                        ? 'Cannot edit date'
                        : 'Click to edit enrollment date'
                }
            >
                {new Date(displayDate).toLocaleDateString()}
                <PencilSquareIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>

            <FormModal
                ref={modalRef}
                title="Update Enrollment Date"
                defaultValues={defaultValues}
                inputs={[
                    {
                        type: FormInputTypes.Date,
                        label: 'Enrollment Date',
                        interfaceRef: 'enrolled_date',
                        required: true,
                        allowPastDate: true,
                        validate: validateEnrollmentDate
                    }
                ]}
                onSubmit={handleDateUpdate}
                onClose={() => {
                    modalRef.current?.close();
                }}
                showCancel
                submitText="Update Date"
            />
        </>
    );
}
