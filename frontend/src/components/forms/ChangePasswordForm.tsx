import { useEffect, useMemo, useState } from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import API from '@/api/api';
import { AuthResponse, ServerResponseOne, UserRole, Timezones } from '@/types';
import {
    buildChangePasswordSchema,
    ChangePasswordInput
} from '@/lib/validation';
import { AUTHCALLBACK, fetchUser } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

function getDefaultTimezone(): string {
    const allowed = Object.values(Timezones) as string[];
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return allowed.includes(browserTz) ? browserTz : Timezones.CST;
}

export default function ChangePasswordForm() {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');
    const [processing, setProcessing] = useState(false);
    const [isFirstLogin, setIsFirstLogin] = useState(false);

    const resolver = useMemo(
        () => zodResolver(buildChangePasswordSchema(isFirstLogin)),
        [isFirstLogin]
    );
    const form = useForm<ChangePasswordInput>({
        resolver,
        defaultValues: {
            password: '',
            confirm: '',
            facility_name: '',
            timezone: getDefaultTimezone()
        }
    });
    const { control, handleSubmit, reset } = form;

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
    const passwordsMatch = !!password && password === confirm;
    const validFacility =
        facility && facility.length > 2 && facility.trim().length > 2;

    const submit: SubmitHandler<ChangePasswordInput> = async (data) => {
        setErrorMessage('');
        setProcessing(true);
        if (data.facility_name) {
            data.facility_name = data.facility_name.trim();
        }
        const response = (await API.post<AuthResponse, ChangePasswordInput>(
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
        <Form {...form}>
            <form
                onSubmit={(e) => {
                    void handleSubmit(submit)(e);
                }}
            >
                <FormField
                    control={control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-foreground">
                                New password
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    maxLength={50}
                                    autoComplete="new-password"
                                    autoFocus
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

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

                <FormField
                    control={control}
                    name="confirm"
                    render={({ field }) => (
                        <FormItem className="space-y-2 mt-4">
                            <FormLabel className="text-foreground">
                                Confirm password
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    maxLength={50}
                                    autoComplete="new-password"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="mt-2 text-sm">
                    <ValidationItem
                        valid={passwordsMatch}
                        text="Passwords match"
                    />
                </div>

                {errorMessage && (
                    <p className="mt-3 text-sm text-destructive">
                        {errorMessage}
                    </p>
                )}

                {isFirstLogin && (
                    <>
                        <FormField
                            control={control}
                            name="facility_name"
                            render={({ field }) => (
                                <FormItem className="space-y-2 mt-4">
                                    <FormLabel className="text-foreground">
                                        New default facility name
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            maxLength={50}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="mt-2 text-sm">
                            <ValidationItem
                                valid={!!validFacility}
                                text="Valid facility name"
                            />
                        </div>

                        <FormField
                            control={control}
                            name="timezone"
                            render={({ field }) => (
                                <FormItem className="space-y-2 mt-4">
                                    <FormLabel className="text-foreground">
                                        Timezone
                                    </FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a timezone" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.entries(Timezones).map(
                                                ([label, value]) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}

                <div className="flex items-center justify-end mt-6">
                    <Button
                        type="submit"
                        disabled={processing}
                        className="btn-gold"
                    >
                        {processing ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            'Reset Password'
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
