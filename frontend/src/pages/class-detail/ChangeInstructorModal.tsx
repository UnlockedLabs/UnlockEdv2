import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import { User, UserRole, ServerResponseMany } from '@/types';
import {
    BulkSessionFieldModal,
    BulkSessionFieldSession
} from './BulkSessionFieldModal';

export type ChangeInstructorSession = BulkSessionFieldSession;

interface ChangeInstructorModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    classFacilityId: number;
    sessions: ChangeInstructorSession[];
    onChanged: () => void;
    applyToFuture?: boolean;
    setApplyToFuture?: (apply: boolean) => void;
    futureSessions?: ChangeInstructorSession[];
    showSessionsList?: boolean;
}

const INSTRUCTOR_REASON_OPTIONS = [
    { value: 'instructor_unavailable', label: 'Instructor Unavailable' },
    { value: 'instructor_illness', label: 'Instructor Illness' },
    { value: 'scheduling_conflict', label: 'Scheduling Conflict' },
    { value: 'personal_emergency', label: 'Personal Emergency' },
    { value: 'other', label: 'Other' }
];

export function ChangeInstructorModal(props: ChangeInstructorModalProps) {
    const { classFacilityId, ...rest } = props;
    const { user } = useAuth();
    const roleParam =
        user?.role === UserRole.FacilityAdmin
            ? 'facility_admin'
            : 'department_admin';
    const { data: instructorsResp } = useSWR<ServerResponseMany<User>>(
        props.open && user
            ? `/api/users?role=${roleParam}&facility_id=${classFacilityId}&per_page=100`
            : null
    );
    const options = (instructorsResp?.data ?? []).map((inst) => ({
        id: inst.id,
        label: `${inst.name_first} ${inst.name_last}`
    }));

    return (
        <BulkSessionFieldModal
            {...rest}
            title="Change Instructor"
            subject="Instructor"
            idPrefix="instructor"
            options={options}
            payloadKey="instructor_id"
            reasonOptions={INSTRUCTOR_REASON_OPTIONS}
        />
    );
}
