import { useForm, SubmitHandler } from 'react-hook-form';
import { CloseX, TextInput, SubmitButton } from '../inputs';
import {
    AddResourceCollectionFormProps,
    Inputs
} from './AddResourceCollectionForm';

export default function AddResourceCollectionForm({
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
                onSubmit={() => {
                    void handleSubmit(onSubmit);
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
