import { User, UserRole } from '../../common';
import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { TextInput } from '../inputs/TextInput';
import { DropdownInput } from '../inputs/DropdownInput';
import { SubmitButton } from '../inputs/SubmitButton';
import { CloseX } from '../inputs/CloseX';
import API from '@/api/api';

type Inputs = {
    name_first: string;
    name_last: string;
    username: string;
    role: UserRole;
    email: string;
};

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
            username: user.username,
            role: user.role as UserRole,
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
        const resp = await API.patch(`users/${user.id}`, cleanData);
        if (!resp.success) {
            const msg = resp.message;
            if (msg === 'userexists') {
                setError('username', {
                    type: 'custom',
                    message: 'Username already exists'
                });
            } else {
                setErrorMessage(msg);
            }
        }
        onSuccess();
    };

    return (
        <>
            <CloseX close={() => onSuccess()} />
            <form onSubmit={handleSubmit(onSubmit)}>
                <TextInput
                    label={'First Name'}
                    interfaceRef={'name_first'}
                    required={true}
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={'Last Name'}
                    interfaceRef={'name_last'}
                    required={true}
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={'Username'}
                    interfaceRef={'username'}
                    required={true}
                    length={50}
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
                <DropdownInput
                    label={'Role'}
                    interfaceRef={'role'}
                    required={true}
                    errors={errors}
                    register={register}
                    enumType={UserRole}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </>
    );
}
