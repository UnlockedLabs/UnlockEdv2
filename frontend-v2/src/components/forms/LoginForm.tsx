import { useLoaderData, useNavigate } from 'react-router-dom';
import { AuthFlow, AuthResponse, ServerResponseOne } from '@/types';
import { SubmitHandler, useForm } from 'react-hook-form';
import API from '@/api/api';
import { useEffect, useState } from 'react';
import { tabSessionManager } from '@/session/tabSession';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Inputs {
    identifier: string;
    password: string;
    flow_id: string;
    challenge: string;
    csrf_token: string;
}

export default function LoginForm() {
    const navigate = useNavigate();
    const loaderData = useLoaderData() as AuthFlow;
    const [processing, setProcessing] = useState(false);
    const [user, setUser] = useState<string | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState(false);
    const [errorType, setErrorType] = useState<
        'generic' | 'locked' | 'deactivated'
    >('generic');
    const [lockedOutSeconds, setLockedOutSeconds] = useState<number | null>(
        null
    );
    const [countdownDisplay, setCountdownDisplay] = useState<string>('');
    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors }
    } = useForm<Inputs>();

    useEffect(() => {
        if (lockedOutSeconds === null) {
            setCountdownDisplay('');
            return;
        }
        if (lockedOutSeconds <= 0) {
            setLockedOutSeconds(null);
            setCountdownDisplay('');
            return;
        }
        const timer = setInterval(() => {
            setLockedOutSeconds((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        const minutes = Math.floor(lockedOutSeconds / 60);
        const seconds = lockedOutSeconds % 60;
        setCountdownDisplay(
            minutes > 0
                ? `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`
                : `${seconds} second${seconds !== 1 ? 's' : ''}`
        );
        return () => clearInterval(timer);
    }, [lockedOutSeconds]);

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        if (user) {
            data.identifier = user;
        }
        setErrorMessage(false);
        setErrorType('generic');
        setProcessing(true);
        setValue('password', '');
        const resp = (await API.post<AuthResponse, Inputs>(
            'login',
            data
        )) as ServerResponseOne<AuthResponse>;
        if (resp.success) {
            tabSessionManager.onLogin();
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
        }
    }, [loaderData]);

    const renderError = () => {
        if (!errorMessage) return null;
        if (
            errorType === 'locked' &&
            lockedOutSeconds !== null &&
            lockedOutSeconds > 0
        ) {
            return `Currently locked out. Try again in ${countdownDisplay}.`;
        }
        if (errorType === 'deactivated') {
            return 'Account deactivated. Contact the facility administrator for support.';
        }
        return 'Incorrect username or password.';
    };

    return (
        <form
            onSubmit={(e) => {
                void handleSubmit(onSubmit)(e);
            }}
        >
            <input
                type="hidden"
                {...register('flow_id')}
                value={loaderData.flow_id}
            />
            <input
                type="hidden"
                {...register('challenge')}
                value={loaderData.challenge ?? ''}
            />
            <input
                type="hidden"
                {...register('csrf_token')}
                value={loaderData.csrf_token}
            />
            {user ? (
                <div className="space-y-2">
                    <Label className="text-[#203622]">Username</Label>
                    <div className="flex h-9 w-full items-center rounded-md border px-3 py-1 text-sm text-[#203622] bg-muted">
                        {user}
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-[#203622]">
                        Username
                    </Label>
                    <Input
                        id="identifier"
                        type="text"
                        maxLength={50}
                        autoFocus
                        {...register('identifier', {
                            required: 'Username is required'
                        })}
                    />
                    {errors.identifier && (
                        <p className="text-sm text-destructive">
                            {errors.identifier.message}
                        </p>
                    )}
                </div>
            )}

            <div className="space-y-2 mt-4">
                <Label htmlFor="password" className="text-[#203622]">
                    Password
                </Label>
                <Input
                    id="password"
                    type="password"
                    maxLength={50}
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

            {errorMessage && (
                <p className="mt-3 text-sm text-destructive">
                    {renderError()}
                </p>
            )}

            <div className="flex items-center justify-end mt-6">
                <Button
                    type="submit"
                    disabled={processing}
                    className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-semibold"
                >
                    {processing ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        'Log in'
                    )}
                </Button>
            </div>
        </form>
    );
}
