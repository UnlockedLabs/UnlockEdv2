import { useState } from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import InputError from '../../Components/inputs/InputError';
import PrimaryButton from '../../Components/PrimaryButton';
import { TextInput } from '../../Components/inputs/TextInput';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/useAuth';
import API from '@/api/api';
import { Facility, UserRole } from '@/common';
import { useLoaderData } from 'react-router-dom';
interface Inputs {
    password: string;
    confirm: string;
    facility_name: string;
}

export default function ChangePasswordForm() {
    const [errorMessage, setErrorMessage] = useState('');
    const [processing, setProcessing] = useState(false);
    const loaderData = useLoaderData() as Facility | null;
    const { user } = useAuth();

    if (!user) {
        return <div>Loading...</div>;
    }

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>();

    const password = useWatch({
        control,
        name: 'password'
    });

    const confirm = useWatch({
        control,
        name: 'confirm'
    });

    const facility = useWatch({
        control,
        name: 'facility_name'
    });

    const isLengthValid = password && password.length >= 8;
    const hasNumber = /\d/.test(password);
    const passwordsMatch = password === confirm;
    const isValid = isLengthValid && hasNumber && passwordsMatch;
    const validFacility =
        facility && facility.length > 2 && facility.trim().length > 2;
    const isFirstAdminLogin =
        user.id === 1 &&
        user.role === UserRole.Admin &&
        loaderData?.name === 'Default';

    const submit: SubmitHandler<Inputs> = async (data) => {
        setErrorMessage('');
        setProcessing(true);
        if (data.facility_name) {
            data.facility_name = data.facility_name.trim();
        }
        const response = await API.post('reset-password', data);
        if (response.success) {
            const location =
                user.role === UserRole.Admin
                    ? '/admin-dashboard'
                    : '/dashboard';
            window.location.href = location;
        } else {
            setErrorMessage(`Your passwords did not pass validation, 
        please check that they match and are 8 or more characters with at least 1 number.`);
            reset();
        }
    };

    return (
        <form
            onSubmit={(e) => {
                void handleSubmit(submit)(e);
            }}
        >
            <TextInput
                label={'New password'}
                interfaceRef={'password'}
                length={50}
                required
                errors={errors}
                register={register}
                password
                autoComplete="new-password"
                isFocused
            />

            <div className="mt-2 text-sm">
                <p
                    className={`flex items-center ${isLengthValid ? 'text-success' : 'text-error'}`}
                >
                    {isLengthValid ? (
                        <CheckIcon className="h-5 w-5" />
                    ) : (
                        <XMarkIcon className="h-5 w-5" />
                    )}{' '}
                    Password is 8 or more characters
                </p>
                <p
                    className={`flex items-center ${hasNumber ? 'text-success' : 'text-error'}`}
                >
                    {hasNumber ? (
                        <CheckIcon className="h-5 w-5" />
                    ) : (
                        <XMarkIcon className="h-5 w-5" />
                    )}{' '}
                    Password includes at least one number
                </p>
            </div>

            <TextInput
                label={'Confirm password'}
                interfaceRef={'confirm'}
                length={50}
                required
                errors={errors}
                register={register}
                password
                autoComplete="new-password"
            />

            <div className="mt-2 text-sm">
                <p
                    className={`flex items-center ${passwordsMatch ? 'text-success' : 'text-error'}`}
                >
                    {passwordsMatch ? (
                        <CheckIcon className="h-5 w-5" />
                    ) : (
                        <XMarkIcon className="h-5 w-5" />
                    )}{' '}
                    Passwords match
                </p>
            </div>

            {errorMessage && (
                <div className="block">
                    <InputError message={errorMessage} className="pt-2" />
                </div>
            )}

            {isFirstAdminLogin && (
                <>
                    <TextInput
                        label={'New default facility name'}
                        interfaceRef={'facility_name'}
                        length={50}
                        required
                        errors={errors}
                        register={register}
                        password={false}
                        autoComplete=""
                    />
                    <div className="mt-2 text-sm">
                        <p
                            className={`flex items-center ${validFacility ? 'text-success' : 'text-error'}`}
                        >
                            {validFacility ? (
                                <CheckIcon className="h-5 w-5" />
                            ) : (
                                <XMarkIcon className="h-5 w-5" />
                            )}{' '}
                            Valid facility name
                        </p>
                    </div>
                </>
            )}

            <div className="flex items-center justify-end mt-4">
                <PrimaryButton
                    className="ms-4 w-44 h-10"
                    disabled={processing || !isValid}
                >
                    {processing ? (
                        <span className="loading loading-spinner loading-sm mx-auto"></span>
                    ) : (
                        <div className="m-auto">Reset Password</div>
                    )}
                </PrimaryButton>
            </div>
        </form>
    );
}
