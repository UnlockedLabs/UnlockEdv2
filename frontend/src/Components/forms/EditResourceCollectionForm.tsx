// Component form that takes in a category and gives the user the ability to rename it. Calls back onSuccess when the category is renamed.

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { TextInput, CloseX, SubmitButton } from '../inputs';

type Inputs = {
    collectionName: string;
};

export default function EditResourceCollectionForm({
    collectionName,
    onSuccess
}: {
    collectionName: string;
    onSuccess: (newCollectionName: string) => void;
}) {
    const [errorMessage, _] = useState();
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

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        onSuccess(data.collectionName);
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
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
