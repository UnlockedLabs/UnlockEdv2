import useSWR from 'swr';
import { Room, ServerResponseMany } from '@/types';
import {
    BulkSessionFieldModal,
    BulkSessionFieldSession
} from './BulkSessionFieldModal';

export type ChangeRoomSession = BulkSessionFieldSession;

interface ChangeRoomModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    classFacilityId: number;
    sessions: ChangeRoomSession[];
    onChanged: () => void;
    applyToFuture?: boolean;
    setApplyToFuture?: (apply: boolean) => void;
    futureSessions?: ChangeRoomSession[];
    showSessionsList?: boolean;
}

const ROOM_REASON_OPTIONS = [
    { value: 'room_unavailable', label: 'Room Unavailable' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'capacity_issue', label: 'Capacity Issue' },
    { value: 'equipment_needed', label: 'Equipment Needed' },
    { value: 'other', label: 'Other' }
];

export function ChangeRoomModal(props: ChangeRoomModalProps) {
    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        props.open
            ? props.classFacilityId
                ? `/api/rooms?facility_id=${props.classFacilityId}`
                : '/api/rooms'
            : null
    );
    const options = (roomsResp?.data ?? []).map((room) => ({
        id: room.id,
        label: room.name
    }));

    return (
        <BulkSessionFieldModal
            {...props}
            title="Change Room"
            subject="Room"
            idPrefix="room"
            options={options}
            payloadKey="room_id"
            reasonOptions={ROOM_REASON_OPTIONS}
        />
    );
}
