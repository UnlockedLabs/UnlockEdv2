import {
    NewUserResponse,
    ProviderPlatform,
    ToastState,
    UserRole
} from '@/common.ts';
import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX } from '../inputs/CloseX';
import { TextInput } from '../inputs/TextInput';
import { DropdownInput } from '@/Components/inputs';
import { SubmitButton } from '@/Components/inputs';
import API from '@/api/api';

interface Inputs {
    name_first: string;
    name_last: string;
    username: string;
    role: UserRole;
}

export default function AddUserForm({
    onSuccess
}: {
    onSuccess: (psw: string, msg: string, err: ToastState) => void;
}) {
    const [errorMessage, setErrorMessage] = useState('');
    const [providers, setProviders] = useState<ProviderPlatform[]>([]);
    const [selectedProviders, setSelectedProviders] = useState<number[]>([]);
    const {
        reset,
        register,
        handleSubmit,
        setError,
        formState: { errors }
    } = useForm<Inputs>();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        setErrorMessage('');
        const response = await API.post<NewUserResponse>('users', {
            user: data,
            provider_platforms: selectedProviders
        });
        console.log('form response: ', response);
        if (!response.success) {
            const msg = response.message.trim();
            switch (msg) {
                case 'userexists': {
                    setError('username', {
                        type: 'custom',
                        message: 'Username already exists'
                    });
                    break;
                }
                case 'alphanum': {
                    setError('username', {
                        type: 'custom',
                        message:
                            'Username must contain only letters and numbers'
                    });
                    break;
                }
                default: {
                    setErrorMessage(msg);
                }
            }
            return;
        }
        reset();
        onSuccess(
            (response.data as NewUserResponse).temp_password,
            'User created successfully with temporary password',
            ToastState.success
        );
    };

    const handleAddUserToProviderList = (providerId: number) => {
        if (selectedProviders.includes(providerId)) {
            setSelectedProviders(
                selectedProviders.filter((id) => id !== providerId)
            );
        } else {
            setSelectedProviders([...selectedProviders, providerId]);
        }
    };

    useEffect(() => {
        const fetchActiveProviders = async () => {
            const resp = await API.get<ProviderPlatform>(
                `provider-platforms?only=oidc_enabled`
            );
            if (resp.success) {
                setProviders(resp.data as ProviderPlatform[]);
            }
        };
        void fetchActiveProviders();
    }, []);

    return (
        <div>
            <CloseX close={() => reset()} />
            <form
                onSubmit={(e) => {
                    const func = handleSubmit(onSubmit);
                    void func(e);
                }}
            >
                <TextInput
                    label={'First Name'}
                    interfaceRef={'name_first'}
                    required
                    length={25}
                    errors={errors}
                    register={register}
                    pattern={{
                        value: /^[A-Za-z\s]+$/,
                        message:
                            'First name can only contain letters and spaces'
                    }}
                />
                <TextInput
                    label={'Last Name'}
                    interfaceRef={'name_last'}
                    required
                    length={25}
                    errors={errors}
                    register={register}
                    pattern={{
                        value: /^[A-Za-z\s]+$/,
                        message: 'Last name can only contain letters and spaces'
                    }}
                />
                {/*Proper regEx applied for expected validation*/}
                {/*Backend error handling throws: "Username must contain only letters and numbers"*/}
                <TextInput
                    label={'Username'}
                    interfaceRef={'username'}
                    required
                    length={50}
                    errors={errors}
                    register={register}
                    pattern={{
                        value: /^[A-Za-z0-9]+$/,
                        message:
                            'Username can only contain letters and numbers without spaces'
                    }}
                />

                <DropdownInput
                    label={'Role'}
                    interfaceRef={'role'}
                    required
                    errors={errors}
                    register={register}
                    enumType={UserRole}
                />
                <br />
                {providers?.map((provider: ProviderPlatform) => (
                    <div
                        className="tooltip"
                        data-tip="Also create account in provider platform"
                        key={provider.id}
                    >
                        <div className="justify-items-center">
                            Create New Account for User in:
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer gap-2">
                                <label className="badge-md">
                                    {provider.name}
                                </label>
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    onChange={() =>
                                        handleAddUserToProviderList(provider.id)
                                    }
                                />
                            </label>
                        </div>
                    </div>
                ))}
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
