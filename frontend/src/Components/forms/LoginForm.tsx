import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import InputError from '../../Components/inputs/InputError';
import PrimaryButton from '../../Components/PrimaryButton';
import { TextInput } from '../../Components/inputs/TextInput';
import axios from 'axios';
import { handleLogout } from '@/useAuth';
import { AuthResponse, BROWSER_URL } from '@/common';
import API from '@/api/api';

interface Inputs {
    identifier: string;
    password: string;
    flow_id: string;
    challenge: string;
    csrf_token: string;
}

export default function LoginForm() {
    const [errorMessage, setErrorMessage] = useState('');
    const [processing, setProcessing] = useState(false);
    const [user, setUser] = useState<string | undefined>();
    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<Inputs>();
    const kratosUrl = '/self-service/login/flows?id=';
    const sessionUrl = '/sessions/whoami';

    const submit: SubmitHandler<Inputs> = async (data) => {
        const attributes = await initFlow();
        user ? (data.identifier = user) : data.identifier;
        const reqBody = { ...data, ...attributes };
        setErrorMessage('');
        setProcessing(true);
        const params = new URLSearchParams(window.location.search);
        const resp = await API.post<AuthResponse>('login', reqBody);
        if (resp.success) {
            const location =
                (resp.data as AuthResponse).redirect_to ||
                resp.data['redirect_browser_to'] ||
                (params.get('return_to') as string) ||
                '/dashboard';
            window.location.replace(location);
            return;
        }
        setProcessing(false);
        setErrorMessage('Login failed, Invalid username or password');
    };

    useEffect(() => {
        const checkExistingFlow = async () => {
            try {
                const checkResp = await axios.get(sessionUrl);
                if (checkResp.status === 200 && checkResp.data.active) {
                    setUser(checkResp.data.identity.traits.username);
                    const attributes = await initFlow();
                    const reqBody = {
                        identity: checkResp.data.identity.id,
                        csrf_token: attributes.csrf_token,
                        session: checkResp.data,
                        challenge: attributes.challenge
                    };
                    const resp = await API.post<AuthResponse>(
                        'auth/refresh',
                        reqBody
                    );
                    resp.success &&
                        window.location.replace(
                            (resp.data as AuthResponse).redirect_to
                        );
                    return;
                }
                // eslint-disable-next-line
            } catch (error: any) {
                //Todo: unsure about what to type this as Error or ApiError
                console.error('No active sessions found for this user');
                return;
            }
        };
        checkExistingFlow();
    }, []);

    const initFlow = async () => {
        const queryParams = new URLSearchParams(window.location.search);
        if (!queryParams.has('flow')) {
            setErrorMessage('No login flow specified');
            window.location.replace(BROWSER_URL);
            return;
        }
        const url = kratosUrl + queryParams.get('flow');
        const resp = await axios.get(url);
        if (resp.status !== 200) {
            console.error('Error initializing login flow');
            return;
        }
        return {
            flow_id: resp.data.id,
            challenge: resp.data.oauth2_login_challenge,
            csrf_token: resp.data.ui.nodes[0].attributes.value
        };
    };

    return (
        <form onSubmit={handleSubmit(submit)}>
            {user ? (
                <div className="block">
                    <div className="text-lg text-center font-bold">
                        Logged in as
                        <div className="text-primary text-3xl text-bold">
                            {user}
                        </div>
                        Please confirm your password.
                    </div>
                </div>
            ) : (
                <TextInput
                    label={'Username'}
                    interfaceRef={'identifier'}
                    required
                    length={50}
                    errors={errors}
                    register={register}
                />
            )}

            <TextInput
                label={'Password'}
                interfaceRef={'password'}
                required
                length={50}
                errors={errors}
                register={register}
                password
            />

            {errorMessage && (
                <div className="block">
                    <InputError message={errorMessage} className="pt-2" />
                </div>
            )}
            {user && (
                <div className="text-sm text-body-text text-center mt-2">
                    <button
                        className="btn pr-3 btn-sm btn-ghost"
                        autoFocus={false}
                        onClick={handleLogout}
                    >
                        Not You? Log out
                    </button>
                </div>
            )}
            <div className="flex items-center justify-end mt-4">
                <PrimaryButton
                    className="ms-4 w-24 h-10"
                    autoFocus
                    disabled={processing}
                >
                    {processing ? (
                        <span className="loading loading-spinner loading-sm mx-auto"></span>
                    ) : (
                        <div className="m-auto">
                            {user ? 'Confirm' : 'Log in'}
                        </div>
                    )}
                </PrimaryButton>
            </div>
        </form>
    );
}
