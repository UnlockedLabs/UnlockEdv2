import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import {
    CloseX,
    DropdownInput,
    SubmitButton,
    TextAreaInput,
    TextInput
} from './inputs';
import { forwardRef } from 'react';

export enum FormInputTypes {
    Text,
    Dropdown,
    TextArea
}

export interface Input {
    type: FormInputTypes;
    label: string;
    interfaceRef: string;
    required: boolean;
    enumType?: Record<string, string>;
    length?: number;
}

interface ModalProps<T extends FieldValues> {
    title: string;
    inputs: Input[];
    onSubmit: SubmitHandler<T>;
}

export const NewModal = forwardRef(function NewModal<T extends FieldValues>(
    { title, inputs, onSubmit }: ModalProps<T>,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const {
        register,
        reset,
        handleSubmit,
        formState: { errors }
    } = useForm<T>();
    return (
        <dialog ref={ref} className="modal relative">
            <div className="modal-box">
                <CloseX close={() => void reset()} />
                <div className="flex flex-col">
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        {title}
                    </span>
                    <form
                        onSubmit={(e) => {
                            void handleSubmit(onSubmit)(e);
                        }}
                    >
                        {inputs.map((input: Input) => {
                            if (input.type == FormInputTypes.Text) {
                                return (
                                    <TextInput
                                        label={input.label}
                                        interfaceRef={input.interfaceRef}
                                        required={input.required}
                                        length={input.length}
                                        errors={errors}
                                        register={register}
                                    />
                                );
                            }
                            if (input.type == FormInputTypes.Dropdown) {
                                if (!input.enumType) return;
                                return (
                                    <DropdownInput
                                        label={input.label}
                                        interfaceRef={input.interfaceRef}
                                        required={input.required}
                                        errors={errors}
                                        register={register}
                                        enumType={input.enumType}
                                    />
                                );
                            }
                            if (input.type == FormInputTypes.TextArea) {
                                return (
                                    <TextAreaInput
                                        label={input.label}
                                        interfaceRef={input.interfaceRef}
                                        required={input.required}
                                        length={input.length}
                                        errors={errors}
                                        register={register}
                                    />
                                );
                            }
                            return;
                        })}
                        <SubmitButton />
                    </form>
                </div>
            </div>
        </dialog>
    );
});
export default NewModal;
