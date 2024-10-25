// Component form that takes in a category and gives the user the ability to rename it. Calls back onSuccess when the category is renamed.

import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, SubmitButton, TextInput } from '../inputs';

interface Inputs {
    collectionName: string;
}

export default function EditResourceCollectionForm({
    collectionName,
    onSuccess
}: {
    collectionName: string;
    onSuccess: (newCollectionName: string) => void;
}) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Inputs>({
        values: {
            collectionName: collectionName
        }
    });

    const onSubmit: SubmitHandler<Inputs> = (data) => {
        onSuccess(data.collectionName);
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
                <SubmitButton />
            </form>
        </div>
    );
}
