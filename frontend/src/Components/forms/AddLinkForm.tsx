import { SubmitHandler, useForm } from 'react-hook-form';
import { SubmitButton } from '../inputs/SubmitButton';
import { TextInput } from '../inputs/TextInput';
import { CloseX } from '../inputs/CloseX';
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

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        onSuccess(data.title, data.url);
        reset();
    };

    return (
        <div>
            <CloseX close={() => reset()} />
            <form onSubmit={handleSubmit(onSubmit)}>
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
                <SubmitButton />
            </form>
        </div>
    );
}
