import { useRef, useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { ToastState, UserRole } from '@/common';
import { Instructor } from '@/types/events';
import { useToast } from '@/Context/ToastCtx';
import API from '@/api/api';
import { getDefaultSelectStyles } from '@/Components/helperFunctions/selectStyles';
import { CloseX } from '@/Components/inputs';

interface InstructorOption {
    value: number | 'create';
    label: string;
}

interface InstructorSelectorProps {
    label: string;
    value: number | null;
    onChange: (instructorId: number | null, instructorName?: string) => void;
    onInstructorCreated?: (instructor: Instructor) => void;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    facilityId: number;
}

interface FormData {
    name_first: string;
    name_last: string;
    username: string;
    email: string;
    role: UserRole;
}

interface FormErrors {
    name_first?: string;
    name_last?: string;
    username?: string;
    email?: string;
    role?: string;
}

export function InstructorSelector({
    label,
    value,
    onChange,
    onInstructorCreated,
    required,
    disabled,
    error,
    facilityId
}: InstructorSelectorProps) {
    const modalRef = useRef<HTMLDialogElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [menuPortalTarget, setMenuPortalTarget] =
        useState<HTMLElement | null>(null);
    const { toaster } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [formData, setFormData] = useState<FormData>({
        name_first: '',
        name_last: '',
        username: '',
        email: '',
        role: UserRole.FacilityAdmin
    });
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    useEffect(() => {
        async function fetchInstructors() {
            const resp = await API.get<Instructor>(
                `facilities/${facilityId}/instructors`
            );
            if (resp.success && resp.data) {
                setInstructors(resp.data as Instructor[]);
            }
        }
        void fetchInstructors();
    }, [facilityId]);

    useEffect(() => {
        if (containerRef.current) {
            const dialog = containerRef.current.closest('dialog');
            if (dialog) {
                setMenuPortalTarget(dialog);
            }
        }
    }, []);

    const options: InstructorOption[] = useMemo(() => {
        const instructorOptions: InstructorOption[] = instructors.map(
            (i: Instructor): InstructorOption => ({
                value: i.id,
                label: `${i.name_first} ${i.name_last}`
            })
        );
        return [
            ...instructorOptions,
            { value: 'create' as const, label: '+ Add new instructor' }
        ];
    }, [instructors]);

    const validateForm = (): boolean => {
        const errors: FormErrors = {};

        if (!formData.name_first.trim()) {
            errors.name_first = 'First name is required';
        } else if (!/^[a-zA-Z\s-]+$/.test(formData.name_first)) {
            errors.name_first =
                'Must contain only letters, spaces, and hyphens';
        }

        if (!formData.name_last.trim()) {
            errors.name_last = 'Last name is required';
        } else if (!/^[a-zA-Z\s-]+$/.test(formData.name_last)) {
            errors.name_last = 'Must contain only letters, spaces, and hyphens';
        }

        if (!formData.username.trim()) {
            errors.username = 'Username is required';
        } else if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
            errors.username = 'Username must contain only letters and numbers';
        }

        if (
            formData.email.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
        ) {
            errors.email = 'Invalid email format';
        }

        if (!formData.role) {
            errors.role = 'Role is required';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateInstructor = async () => {
        if (!validateForm()) return;

        setIsCreating(true);
        const resp = await API.post('users', {
            user: {
                name_first: formData.name_first.trim(),
                name_last: formData.name_last.trim(),
                username: formData.username.trim(),
                email: formData.email.trim(),
                role: formData.role
            },
            provider_platforms: []
        });
        setIsCreating(false);

        if (resp.success && resp.data) {
            const newUser = resp.data as {
                user: Instructor;
                temp_password: string;
            };
            const newInstructor: Instructor = newUser.user;
            setInstructors((prev) => {
                const updated: Instructor[] = [...prev, newInstructor];
                return updated;
            });
            onChange(newInstructor.id);
            onInstructorCreated?.(newInstructor);
            setFormData({
                name_first: '',
                name_last: '',
                username: '',
                email: '',
                role: UserRole.FacilityAdmin
            });
            setFormErrors({});
            modalRef.current?.close();
            toaster('Instructor created', ToastState.success);
        } else {
            const msg = resp.message?.trim();
            if (msg === 'userexists') {
                setFormErrors({ username: 'Username already exists' });
                toaster('Username already exists', ToastState.error);
            } else if (msg === 'alphanum') {
                setFormErrors({ username: 'Invalid characters in username' });
                toaster('Invalid characters in username', ToastState.error);
            } else {
                toaster(
                    resp.message || 'Failed to create instructor',
                    ToastState.error
                );
            }
        }
    };

    const handleCancel = () => {
        setFormData({
            name_first: '',
            name_last: '',
            username: '',
            email: '',
            role: UserRole.FacilityAdmin
        });
        setFormErrors({});
        modalRef.current?.close();
    };

    const defaultStyles = getDefaultSelectStyles<InstructorOption, false>();

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
                    placeholder="Select instructor..."
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
                        Add Instructor
                    </span>
                    <div className="space-y-4">
                        <label className="form-control">
                            <div className="label">
                                <span className="label-text">First Name</span>
                            </div>
                            <input
                                type="text"
                                className="input input-bordered"
                                value={formData.name_first}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        name_first: e.target.value
                                    })
                                }
                            />
                            {formErrors.name_first && (
                                <span className="text-error text-sm">
                                    {formErrors.name_first}
                                </span>
                            )}
                        </label>

                        <label className="form-control">
                            <div className="label">
                                <span className="label-text">Last Name</span>
                            </div>
                            <input
                                type="text"
                                className="input input-bordered"
                                value={formData.name_last}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        name_last: e.target.value
                                    })
                                }
                            />
                            {formErrors.name_last && (
                                <span className="text-error text-sm">
                                    {formErrors.name_last}
                                </span>
                            )}
                        </label>

                        <label className="form-control">
                            <div className="label">
                                <span className="label-text">Username</span>
                            </div>
                            <input
                                type="text"
                                className="input input-bordered"
                                value={formData.username}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        username: e.target.value
                                    })
                                }
                            />
                            {formErrors.username && (
                                <span className="text-error text-sm">
                                    {formErrors.username}
                                </span>
                            )}
                        </label>

                        <label className="form-control">
                            <div className="label">
                                <span className="label-text">
                                    Email (optional)
                                </span>
                            </div>
                            <input
                                type="email"
                                className="input input-bordered"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        email: e.target.value
                                    })
                                }
                                placeholder="email@example.com"
                            />
                            {formErrors.email && (
                                <span className="text-error text-sm">
                                    {formErrors.email}
                                </span>
                            )}
                        </label>

                        <label className="form-control">
                            <div className="label">
                                <span className="label-text">Role</span>
                            </div>
                            <select
                                className="select select-bordered"
                                value={formData.role}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        role: e.target.value as UserRole
                                    })
                                }
                            >
                                <option value={UserRole.FacilityAdmin}>
                                    Facility Admin
                                </option>
                                <option value={UserRole.DepartmentAdmin}>
                                    Department Admin
                                </option>
                            </select>
                            {formErrors.role && (
                                <span className="text-error text-sm">
                                    {formErrors.role}
                                </span>
                            )}
                        </label>

                        <div className="flex justify-end gap-4 mt-4 pt-4">
                            <button
                                type="button"
                                className="btn"
                                onClick={handleCancel}
                                disabled={isCreating}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isCreating}
                                onClick={() => void handleCreateInstructor()}
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
