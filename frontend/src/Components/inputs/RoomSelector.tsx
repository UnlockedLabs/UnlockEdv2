import { useRef, useState } from 'react';
import {
    Control,
    Controller,
    FieldValues,
    SubmitHandler
} from 'react-hook-form';
import Select from 'react-select';
import { FormModal } from '@/Components/modals/FormModal';
import { Room, ToastState } from '@/common';
import { useToast } from '@/Context/ToastCtx';
import API from '@/api/api';
import { getDefaultSelectStyles } from '@/Components/helperFunctions/selectStyles';

interface RoomOption {
    value: number | 'create';
    label: string;
}

interface RoomSelectorProps {
    name: string;
    label: string;
    control: Control<any>; // eslint-disable-line
    rooms: Room[];
    onRoomCreated: (room: Room) => void;
    required?: boolean;
    disabled?: boolean;
}

const createRoomInputs = [
    {
        type: 0, // FormInputTypes.Text
        label: 'Room Name',
        interfaceRef: 'name',
        required: true,
        length: 255
    }
];

export function RoomSelector({
    name,
    label,
    control,
    rooms,
    onRoomCreated,
    required,
    disabled
}: RoomSelectorProps) {
    const modalRef = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const fieldOnChangeRef = useRef<((value: number | null) => void) | null>(
        null
    );

    const options: RoomOption[] = [
        ...rooms.map((r) => ({ value: r.id, label: r.name })),
        { value: 'create' as const, label: '+ Add new room' }
    ];

    const handleCreateRoom: SubmitHandler<FieldValues> = async (data) => {
        setIsCreating(true);
        const resp = await API.post<Room, { name: string }>('rooms', {
            name: data.name as string
        });
        setIsCreating(false);

        if (resp.success && resp.data) {
            const newRoom = resp.data as Room;
            toaster('Room created', ToastState.success);
            modalRef.current?.close();
            onRoomCreated(newRoom);
            setTimeout(() => {
                fieldOnChangeRef.current?.(newRoom.id);
            }, 50);
        } else {
            toaster(resp.message || 'Failed to create room', ToastState.error);
        }
    };

    const defaultStyles = getDefaultSelectStyles<RoomOption, false>();

    return (
        <>
            <div>
                <label className="form-control">
                    <div className="label">
                        <span className="label-text">{label}</span>
                    </div>
                </label>
                <Controller
                    control={control}
                    name={name}
                    rules={required ? { required: `${label} is required` } : {}}
                    render={({ field, fieldState }) => {
                        fieldOnChangeRef.current = field.onChange;
                        return (
                            <>
                                <Select
                                    {...field}
                                    isDisabled={disabled}
                                    options={options}
                                    placeholder="Select room..."
                                    styles={defaultStyles}
                                    classNamePrefix="react-select"
                                    menuPlacement="auto"
                                    maxMenuHeight={150}
                                    value={
                                        field.value
                                            ? options.find(
                                                  (o) => o.value === field.value
                                              )
                                            : null
                                    }
                                    onChange={(selected) => {
                                        if (selected?.value === 'create') {
                                            modalRef.current?.showModal();
                                            return;
                                        }
                                        field.onChange(selected?.value ?? null);
                                    }}
                                />
                                {fieldState.error && (
                                    <p className="text-error text-sm">
                                        {fieldState.error.message}
                                    </p>
                                )}
                            </>
                        );
                    }}
                />
            </div>
            <FormModal
                ref={modalRef}
                title="Add Room"
                inputs={createRoomInputs}
                onSubmit={handleCreateRoom}
                submitText={isCreating ? 'Creating...' : 'Create'}
                showCancel
            />
        </>
    );
}
