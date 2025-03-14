import { useEffect, useState } from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import InputError from '../../Components/inputs/InputError';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { DropdownInput, TextInput } from '../inputs';
import API from '@/api/api';
import { AuthResponse, ServerResponseOne, UserRole, Timezones } from '@/common';
import { AUTHCALLBACK, fetchUser } from '@/useAuth';
import { useNavigate } from 'react-router-dom';
interface Inputs {
    password: string;
    confirm: string;
    facility_name: string;
    timezone: string;
}

export default function ChangePasswordForm() {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');
    const [processing, setProcessing] = useState(false);
    const [isFirstLogin, setIsFirstLogin] = useState<boolean>(false);
    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>();

    useEffect(() => {
        const getUser = async () => {
            const authUser = await fetchUser();
            if (!authUser?.password_reset) {
                navigate(AUTHCALLBACK);
            }
            setIsFirstLogin(
                authUser?.role === UserRole.SystemAdmin &&
                    authUser?.facility_name === 'Default'
            );
        };
        void getUser();
    }, []);
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

    const submit: SubmitHandler<Inputs> = async (data) => {
        setErrorMessage('');
        setProcessing(true);
        if (data.facility_name) {
            data.facility_name = data.facility_name.trim();
        }
        const response = (await API.post<AuthResponse, Inputs>(
            'reset-password',
            data
        )) as ServerResponseOne<AuthResponse>;
        if (response.success) {
            navigate(response.data.redirect_to);
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

            {isFirstLogin && (
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
                    <DropdownInput
                        label="Timezone"
                        register={register}
                        interfaceRef="timezone"
                        required
                        errors={errors}
                        enumType={Timezones}
                    />
                </>
            )}

            <div className="flex items-center justify-end mt-4">
                <button className="button" disabled={processing || !isValid}>
                    {processing ? (
                        <span className="loading loading-spinner loading-sm mx-auto"></span>
                    ) : (
                        <div className="m-auto">Reset Password</div>
                    )}
                </button>
            </div>
        </form>
    );
}
