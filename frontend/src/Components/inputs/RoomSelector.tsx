import { useRef, useState } from 'react';
import {
    Control,
    Controller,
    FieldValues,
    SubmitHandler
} from 'react-hook-form';
import Select, {
    StylesConfig,
    GroupBase,
    CSSObjectWithLabel
} from 'react-select';
import { FormModal, FormInputTypes, Input } from '@/Components/modals';
import { Room, ToastState } from '@/common';
import { useToast } from '@/Context/ToastCtx';
import API from '@/api/api';

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

const createRoomInputs: Input[] = [
    {
        type: FormInputTypes.Text,
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
            toaster('Room created', ToastState.success);
            modalRef.current?.close();
            onRoomCreated(resp.data as Room);
        } else {
            toaster(resp.message || 'Failed to create room', ToastState.error);
        }
    };

    const defaultStyles: StylesConfig<
        RoomOption,
        false,
        GroupBase<RoomOption>
    > = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: 'var(--base-100)',
            color: 'var(--body-text)',
            border: '1px solid var(--grey-1)',
            borderRadius: '0.375rem',
            minHeight: '42px',
            boxShadow: state.isFocused ? '0 0 0 2px var(--grey-1)' : 'none',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
                borderColor: 'var(--grey-3)'
            }
        }),
        input: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--body-text)',
            outline: 'none',
            backgroundColor: 'var(--base-100)',
            boxShadow: 'var(--base-100)'
        }),
        singleValue: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--body-text)'
        }),
        valueContainer: (provided) => ({
            ...provided,
            backgroundColor: 'var(--base-100)'
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: 'var(--base-100)',
            border: '1px solid var(--grey-1)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
        }),
        menuList: (provided) => ({
            ...provided,
            backgroundColor: 'var(--inner-background)'
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? 'var(--grey-3)'
                : state.isFocused
                  ? 'var(--grey-1)'
                  : 'var(--base-100) !important',
            color: 'var(--body-text)',
            cursor: 'pointer'
        }),
        placeholder: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--grey-3)'
        })
    };

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
                    render={({ field, fieldState }) => (
                        <>
                            <Select
                                {...field}
                                isDisabled={disabled}
                                options={options}
                                placeholder="Select room..."
                                styles={defaultStyles}
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
                    )}
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
