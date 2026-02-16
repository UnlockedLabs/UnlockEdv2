import { useEffect, useState } from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import API from '@/api/api';
import { AuthResponse, ServerResponseOne, UserRole, Timezones } from '@/types';
import { AUTHCALLBACK, fetchUser } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

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
    const [isFirstLogin, setIsFirstLogin] = useState(false);
    const {
        control,
        register,
        handleSubmit,
        reset,
        setValue,
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
                    authUser?.facility.name === 'Default'
            );
        };
        void getUser();
    }, [navigate]);

    const password = useWatch({ control, name: 'password' });
    const confirm = useWatch({ control, name: 'confirm' });
    const facility = useWatch({ control, name: 'facility_name' });

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
            setErrorMessage(
                'Your passwords did not pass validation, please check that they match and are 8 or more characters with at least 1 number.'
            );
            reset();
        }
        setProcessing(false);
    };

    const ValidationItem = ({
        valid,
        text
    }: {
        valid: boolean;
        text: string;
    }) => (
        <p
            className={`flex items-center gap-1 ${valid ? 'text-green-700' : 'text-destructive'}`}
        >
            {valid ? (
                <CheckIcon className="size-5" />
            ) : (
                <XMarkIcon className="size-5" />
            )}
            {text}
        </p>
    );

    return (
        <form
            onSubmit={(e) => {
                void handleSubmit(submit)(e);
            }}
        >
            <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                    New password
                </Label>
                <Input
                    id="password"
                    type="password"
                    maxLength={50}
                    autoComplete="new-password"
                    autoFocus
                    {...register('password', {
                        required: 'Password is required'
                    })}
                />
                {errors.password && (
                    <p className="text-sm text-destructive">
                        {errors.password.message}
                    </p>
                )}
            </div>

            <div className="mt-2 text-sm space-y-1">
                <ValidationItem
                    valid={!!isLengthValid}
                    text="Password is 8 or more characters"
                />
                <ValidationItem
                    valid={hasNumber}
                    text="Password includes at least one number"
                />
            </div>

            <div className="space-y-2 mt-4">
                <Label htmlFor="confirm" className="text-foreground">
                    Confirm password
                </Label>
                <Input
                    id="confirm"
                    type="password"
                    maxLength={50}
                    autoComplete="new-password"
                    {...register('confirm', {
                        required: 'Please confirm your password'
                    })}
                />
                {errors.confirm && (
                    <p className="text-sm text-destructive">
                        {errors.confirm.message}
                    </p>
                )}
            </div>

            <div className="mt-2 text-sm">
                <ValidationItem
                    valid={passwordsMatch}
                    text="Passwords match"
                />
            </div>

            {errorMessage && (
                <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
            )}

            {isFirstLogin && (
                <>
                    <div className="space-y-2 mt-4">
                        <Label
                            htmlFor="facility_name"
                            className="text-foreground"
                        >
                            New default facility name
                        </Label>
                        <Input
                            id="facility_name"
                            type="text"
                            maxLength={50}
                            {...register('facility_name', {
                                required: 'Facility name is required'
                            })}
                        />
                        {errors.facility_name && (
                            <p className="text-sm text-destructive">
                                {errors.facility_name.message}
                            </p>
                        )}
                    </div>

                    <div className="mt-2 text-sm">
                        <ValidationItem
                            valid={!!validFacility}
                            text="Valid facility name"
                        />
                    </div>

                    <div className="space-y-2 mt-4">
                        <Label htmlFor="timezone" className="text-foreground">
                            Timezone
                        </Label>
                        <Select
                            onValueChange={(value) =>
                                setValue('timezone', value)
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(Timezones).map(
                                    ([label, value]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </>
            )}

            <div className="flex items-center justify-end mt-6">
                <Button
                    type="submit"
                    disabled={processing || !isValid}
                    className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90 font-semibold"
                >
                    {processing ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        'Reset Password'
                    )}
                </Button>
            </div>
        </form>
    );
}
