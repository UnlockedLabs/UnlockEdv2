import { useLoaderData, useNavigate } from 'react-router-dom';
import { AuthFlow, AuthResponse, ServerResponseOne } from '@/types';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import API from '@/api/api';
import { useEffect, useState } from 'react';
import { tabSessionManager } from '@/session/tabSession';
import { loginSchema, LoginInput } from '@/lib/validation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useTourContext } from '@/contexts/useTourContext';

function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
    }
    return `${secs} second${secs !== 1 ? 's' : ''}`;
}

export default function LoginForm() {
    const navigate = useNavigate();
    const loaderData = useLoaderData() as AuthFlow;
    const { setTourState } = useTourContext();
    const [processing, setProcessing] = useState(false);
    const [user, setUser] = useState<string | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState(false);
    const [errorType, setErrorType] = useState<
        'generic' | 'locked' | 'deactivated'
    >('generic');
    const [lockedOutSeconds, setLockedOutSeconds] = useState<number | null>(
        null
    );
    const form = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            identifier: '',
            password: '',
            flow_id: '',
            challenge: '',
            csrf_token: ''
        }
    });
    const { control, handleSubmit, setValue } = form;

    const isLockedOut = lockedOutSeconds !== null && lockedOutSeconds > 0;
    useEffect(() => {
        if (!isLockedOut) return;
        const timer = setInterval(() => {
            setLockedOutSeconds((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isLockedOut]);

    const onSubmit: SubmitHandler<LoginInput> = async (data) => {
        if (user) {
            data.identifier = user;
        }
        setErrorMessage(false);
        setErrorType('generic');
        setProcessing(true);
        const resp = (await API.post<AuthResponse, LoginInput>(
            'login',
            data
        )) as ServerResponseOne<AuthResponse>;
        if (resp.success) {
            tabSessionManager.onLogin();
            if (resp.data.first_login) {
                setTourState({ tourActive: true });
            }
            if (resp.data.redirect_to.startsWith('/')) {
                navigate(resp.data.redirect_to);
            } else {
                window.location.href = resp.data.redirect_to;
            }
            return;
        } else if (resp.status && resp.status === 429) {
            const retryAfterHeader = resp.headers?.['retry-after'];
            const secs = retryAfterHeader
                ? parseInt(retryAfterHeader, 10)
                : NaN;
            if (!isNaN(secs) && secs > 0) {
                setLockedOutSeconds(secs);
            } else {
                setLockedOutSeconds(null);
            }
            setErrorType('locked');
            setErrorMessage(true);
            setProcessing(false);
            return;
        } else if (resp.message?.includes('Account deactivated')) {
            setErrorType('deactivated');
            setErrorMessage(true);
            setProcessing(false);
            return;
        }
        setErrorMessage(true);
        setProcessing(false);
    };

    useEffect(() => {
        if (loaderData.redirect_to) {
            window.location.href = loaderData.redirect_to;
            return;
        }
        if (loaderData.identifier) {
            setUser(loaderData.identifier);
            // Pre-fill the identifier so validation passes when the username is
            // shown read-only; onSubmit reassigns it from `user` regardless.
            setValue('identifier', loaderData.identifier);
        }
        setValue('flow_id', loaderData.flow_id ?? '');
        setValue('challenge', loaderData.challenge ?? '');
        setValue('csrf_token', loaderData.csrf_token ?? '');
    }, [loaderData, setValue]);

    const renderError = () => {
        if (!errorMessage) return null;
        if (
            errorType === 'locked' &&
            lockedOutSeconds !== null &&
            lockedOutSeconds > 0
        ) {
            return `Currently locked out. Try again in ${formatCountdown(lockedOutSeconds)}.`;
        }
        if (errorType === 'deactivated') {
            return 'Account deactivated. Contact the facility administrator for support.';
        }
        return 'Incorrect username or password.';
    };

    return (
        <Form {...form}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <input type="hidden" {...form.register('flow_id')} />
                <input type="hidden" {...form.register('challenge')} />
                <input type="hidden" {...form.register('csrf_token')} />
                {user ? (
                    <div className="space-y-2">
                        <Label className="text-foreground">Username</Label>
                        <div className="flex h-9 w-full items-center rounded-md border px-3 py-1 text-sm text-foreground bg-muted">
                            {user}
                        </div>
                    </div>
                ) : (
                    <FormField
                        control={control}
                        name="identifier"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className="text-foreground">
                                    Username
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="text"
                                        maxLength={50}
                                        autoFocus
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="space-y-2 mt-4">
                            <FormLabel className="text-foreground">
                                Password
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    maxLength={50}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {errorMessage && (
                    <p className="mt-3 text-sm text-destructive">
                        {renderError()}
                    </p>
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
                            'Log in'
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
