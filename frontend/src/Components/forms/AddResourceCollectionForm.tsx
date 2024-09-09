import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { TextInput, CloseX, SubmitButton } from '../inputs';

type Inputs = {
    collectionName: string;
    linkName: string;
    linkUrl: string;
};

interface AddResourceCollectionFormProps {
    onSuccess: (
        collectionName: string,
        linkName: string,
        linkUrl: string
    ) => void;
}

export default function AddResourceCollectionForm({
    onSuccess
}: AddResourceCollectionFormProps) {
    const [errorMessage, _] = useState('');
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        onSuccess(data.collectionName, data.linkName, data.linkUrl);
        reset();
    };

    return (
        <div>
            <CloseX close={() => reset()} />
            <form onSubmit={handleSubmit(onSubmit)}>
                <TextInput
                    label="Collection Name"
                    interfaceRef="collectionName"
                    required={true}
                    length={25}
                    errors={errors}
                    register={register}
                />
                <p className="text-sm text-red-500 mt-2">
                    To add a collection, you must also add an accompanying link.
                </p>
                <TextInput
                    label="Link Name"
                    interfaceRef="linkName"
                    required={true}
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label="Link URL"
                    interfaceRef="linkUrl"
                    required={true}
                    length={null}
                    errors={errors}
                    register={register}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
