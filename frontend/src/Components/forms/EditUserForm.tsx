import { ServerResponseOne, User, UserRole } from '@/common.ts';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { TextInput, SubmitButton, CloseX } from '@/Components/inputs';
import API from '@/api/api';

interface Inputs {
    [key: string]: string | UserRole;
    name_first: string;
    name_last: string;
    email: string;
}

export default function EditUserForm({
    onSuccess,
    user
}: {
    onSuccess: () => void;
    user: User;
}) {
    const [errorMessage, setErrorMessage] = useState('');

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors }
    } = useForm<Inputs>({
        defaultValues: {
            name_first: user.name_first,
            name_last: user.name_last,
            role: user.role,
            email: user.email
        }
    });

    function diffFormData(formData: Inputs, currentUserData: User) {
        const changes: Partial<User> = {};
        Object.keys(formData).forEach((key) => {
            if (
                formData[key] !== currentUserData[key] &&
                formData[key] !== undefined
            ) {
                changes[key] = formData[key];
            }
        });
        return changes;
    }

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        setErrorMessage('');
        const cleanData = diffFormData(data, user);
        const resp = (await API.patch(
            `users/${user.id}`,
            cleanData
        )) as ServerResponseOne<User>;
        if (!resp.success) {
            switch (resp.message) {
                case 'alphanum': {
                    setError('name', {
                        type: 'custom',
                        message: 'Name must contain letters and spaces only'
                    });
                    break;
                }
                default: {
                    setErrorMessage(resp.message);
                }
            }
            return;
        }
        onSuccess();
    };

    return (
        <>
            <CloseX close={() => onSuccess()} />
            <form
                onSubmit={(e) => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <TextInput
                    label={'First Name'}
                    interfaceRef={'name_first'}
                    required
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={'Last Name'}
                    interfaceRef={'name_last'}
                    required
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={'Email'}
                    interfaceRef={'email'}
                    required={false}
                    length={50}
                    errors={errors}
                    register={register}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </>
    );
}
