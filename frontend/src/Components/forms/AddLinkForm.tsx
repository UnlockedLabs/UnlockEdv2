import { SubmitHandler, useForm } from 'react-hook-form';
import { SubmitButton } from '../inputs/SubmitButton';
import { TextInput } from '../inputs/TextInput';
import { CloseX } from '../inputs/CloseX';
import { TextAreaInput } from '../inputs';
import { useToast } from '@/Context/ToastCtx';
import { ToastState } from '@/common';
import API from '@/api/api';

interface Inputs {
    title: string;
    url: string;
}

export default function AddLinkForm({
    onSuccess
}: {
    onSuccess: (title: string, url: string) => void;
}) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>();
    const { toaster } = useToast();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        const response = await API.put(`helpful-links`, data);
        if (response.success) {
            toaster('Helpful link added successfully', ToastState.success);
            onSuccess(data.title, data.url);
            reset();
        } else {
            const message =
                String(response.message) === 'existing_helpful_link'
                    ? 'Link already exists'
                    : 'Error adding helpful link';

            toaster(message, ToastState.error);
        }
    };

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
                    label="Title"
                    interfaceRef="title"
                    required
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label="URL"
                    interfaceRef="url"
                    required
                    length={undefined}
                    errors={errors}
                    register={register}
                />
                <TextAreaInput
                    label={'Description'}
                    interfaceRef={'description'}
                    length={255}
                    errors={errors}
                    register={register}
                    required={false}
                />
                <SubmitButton />
            </form>
        </div>
    );
}
