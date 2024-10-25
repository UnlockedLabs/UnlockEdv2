import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, SubmitButton, TextInput } from '../inputs';

export interface Inputs {
    collectionName: string;
    linkName: string;
    linkUrl: string;
}

export interface AddResourceCollectionFormProps {
    onSuccess: (
        collectionName: string,
        linkName: string,
        linkUrl: string
    ) => void;
}

export function AddResourceCollectionForm({
    onSuccess
}: AddResourceCollectionFormProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>();

    const onSubmit: SubmitHandler<Inputs> = (data) => {
        onSuccess(data.collectionName, data.linkName, data.linkUrl);
        reset();
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
                    label="Collection Name"
                    interfaceRef="collectionName"
                    required
                    length={25}
                    errors={errors}
                    register={register}
                />
                <p className="text-sm text-error mt-2">
                    To add a collection, you must also add an accompanying link.
                </p>
                <TextInput
                    label="Link Name"
                    interfaceRef="linkName"
                    required
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label="Link URL"
                    interfaceRef="linkUrl"
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
export default AddResourceCollectionForm;
