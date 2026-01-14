import { useRef, useState, useEffect } from 'react';
import Select from 'react-select';
import { Room, ToastState } from '@/common';
import { useToast } from '@/Context/ToastCtx';
import API from '@/api/api';
import { getDefaultSelectStyles } from '@/Components/helperFunctions/selectStyles';
import { CloseX } from '@/Components/inputs';

interface RoomOption {
    value: number | 'create';
    label: string;
}

interface RoomSelectorProps {
    label: string;
    value: number | null;
    onChange: (roomId: number | null, roomName?: string) => void;
    onRoomCreated?: (room: Room) => void;
    required?: boolean;
    disabled?: boolean;
    error?: string;
}

export function RoomSelector({
    label,
    value,
    onChange,
    onRoomCreated,
    required,
    disabled,
    error
}: RoomSelectorProps) {
    const modalRef = useRef<HTMLDialogElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [menuPortalTarget, setMenuPortalTarget] =
        useState<HTMLElement | null>(null);
    const { toaster } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomName, setRoomName] = useState('');

    useEffect(() => {
        async function fetchRooms() {
            const resp = await API.get<Room>('rooms');
            if (resp.success && resp.data) {
                setRooms(resp.data as Room[]);
            }
        }
        void fetchRooms();
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            const dialog = containerRef.current.closest('dialog');
            if (dialog) {
                setMenuPortalTarget(dialog);
            }
        }
    }, []);

    const options: RoomOption[] = [
        ...rooms.map((r) => ({ value: r.id, label: r.name })),
        { value: 'create' as const, label: '+ Add new room' }
    ];

    const handleCreateRoom = async () => {
        if (!roomName.trim()) return;

        setIsCreating(true);
        const resp = await API.post<Room, { name: string }>('rooms', {
            name: roomName.trim()
        });
        setIsCreating(false);

        if (resp.success && resp.data) {
            const newRoom = resp.data as Room;
            setRooms((prev) => [...prev, newRoom]);
            onChange(newRoom.id);
            onRoomCreated?.(newRoom);
            setRoomName('');
            modalRef.current?.close();
            toaster('Room created', ToastState.success);
        } else {
            toaster(resp.message || 'Failed to create room', ToastState.error);
        }
    };

    const defaultStyles = getDefaultSelectStyles<RoomOption, false>();

    return (
        <>
            <div ref={containerRef}>
                <label className="form-control">
                    <div className="label">
                        <span className="label-text">{label}</span>
                    </div>
                </label>
                <Select
                    isDisabled={disabled}
                    options={options}
                    placeholder="Select room..."
                    styles={defaultStyles}
                    classNamePrefix="react-select"
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    value={options.find((o) => o.value === value) ?? null}
                    onChange={(selected) => {
                        if (selected?.value === 'create') {
                            modalRef.current?.showModal();
                            return;
                        }
                        onChange(
                            selected && typeof selected.value === 'number'
                                ? selected.value
                                : null,
                            selected?.label
                        );
                    }}
                />
                {required && !value && error && (
                    <p className="text-error text-sm">{error}</p>
                )}
            </div>
            <dialog ref={modalRef} className="modal">
                <div className="modal-box">
                    <CloseX close={() => modalRef.current?.close()} />
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        Add Room
                    </span>
                    <div>
                        <label className="form-control">
                            <div className="label">
                                <span className="label-text">Room Name</span>
                            </div>
                            <input
                                type="text"
                                className="input input-bordered"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                maxLength={255}
                            />
                        </label>
                        <div className="flex justify-end gap-4 mt-4 pt-4">
                            <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                    setRoomName('');
                                    modalRef.current?.close();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isCreating || !roomName.trim()}
                                onClick={() => void handleCreateRoom()}
                            >
                                {isCreating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            </dialog>
        </>
    );
}
