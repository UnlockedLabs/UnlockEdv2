import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, SubmitButton, TextAreaInput, TextInput } from '../inputs';
import { HelpfulLink, ToastState } from '@/common';
import { useToast } from '@/Context/ToastCtx';
import API from '@/api/api';

interface Inputs {
    name: string;
    url: string;
    description: string;
}

export default function EditLinkForm({
    link,
    onSuccess
}: {
    link: HelpfulLink;
    onSuccess: () => void;
}) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>({
        values: {
            name: link.name,
            url: link.url,
            description: link.description
        }
    });

    const { toaster } = useToast();
    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        const response = await API.patch(`helpful-links/${link.id}/edit`, data);
        if (response.success) {
            toaster(response.message, ToastState.success);
            onSuccess();
        } else {
            toaster(
                response.message || 'An error occurred during update',
                ToastState.error
            );
        }
        return;
    };

    return (
        <div>
            <CloseX close={() => reset()} />
            <form
                onSubmit={(e) => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <TextInput
                    label="Name"
                    interfaceRef="name"
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
