import {
    useLoaderData,
    Form,
    useNavigation,
    useNavigate
} from 'react-router-dom';
import { TextInput } from '@/Components/inputs/TextInput';
import InputError from '@/Components/inputs/InputError';
import { AuthFlow, AuthResponse, ServerResponseOne } from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import API from '@/api/api';
import { useEffect, useState } from 'react';
import { useTourContext } from '@/Context/TourContext';

interface Inputs {
    identifier: string;
    password: string;
    flow_id: string;
    challenge: string;
    csrf_token: string;
}

export default function LoginForm() {
    const navigate = useNavigate();
    const { setTourState } = useTourContext();
    const loaderData = useLoaderData() as AuthFlow;
    const navigation = useNavigation();
    const processing = navigation.state === 'submitting';
    const [user, setUser] = useState<string | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<Inputs>();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        if (user) {
            data.identifier = user;
        }
        const resp = (await API.post<AuthResponse, Inputs>(
            'login',
            data
        )) as ServerResponseOne<AuthResponse>;
        if (resp.success) {
            if (resp.data.first_login) {
                setTourState({ tourActive: true });
            }
            // if a relative URI, use DOM navigate
            if (resp.data.redirect_to.startsWith('/')) {
                navigate(resp.data.redirect_to);
            } else {
                // if absolute URI, this is a kratos/hyra oauth2 redirect
                window.location.href = resp.data.redirect_to;
            }
            return;
        }
        setErrorMessage(true);
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
    return (
        <Form
            method="post"
            onSubmit={(e) => {
                const func = handleSubmit(onSubmit);
                void func(e);
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
                value={loaderData.challenge}
            />
            <input
                type="hidden"
                {...register('csrf_token')}
                value={loaderData.csrf_token}
            />
            {user ? (
                <div className="block">
                    <label className="label" />
                    <span className="input input-bordered">{user}</span>
                </div>
            ) : (
                <TextInput
                    label="Username"
                    interfaceRef="identifier"
                    required
                    length={50}
                    errors={errors}
                    register={register}
                />
            )}

            <TextInput
                label="Password"
                interfaceRef="password"
                required
                length={50}
                errors={errors}
                register={register}
                password
            />

            {errorMessage && (
                <div className="block">
                    <InputError
                        message={'incorrect username or password'}
                        className="pt-2"
                    />
                </div>
            )}

            <div className="flex items-center justify-end mt-4">
                <button className="button" autoFocus disabled={processing}>
                    {processing ? (
                        <span className="loading loading-spinner loading-sm mx-auto"></span>
                    ) : (
                        <div className="m-auto">Log in</div>
                    )}
                </button>
            </div>
        </Form>
    );
}
