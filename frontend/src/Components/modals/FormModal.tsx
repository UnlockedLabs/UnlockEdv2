import {
    DefaultValues,
    FieldError,
    FieldValues,
    SubmitHandler,
    useForm,
    UseFormGetValues
} from 'react-hook-form';
import {
    CancelButton,
    CheckboxInput,
    CloseX,
    DateInput,
    DropdownInput,
    MultiSelectDropdownInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    TimeInput
} from '../inputs';
import { forwardRef, useEffect } from 'react';
import { FormInputTypes, Input, InputWithOptions } from '.';
import { useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from '../UnlockEdTour';

interface FormModalProps<T extends FieldValues> {
    title: string;
    inputs: Input[];
    defaultValues?: DefaultValues<T>;
    error?: FormError;
    onSubmit: SubmitHandler<T>;
    onClose?: () => void;
    showCancel?: boolean;
    submitText?: string;
    /** Optional attribute is used for any external validation logic you may need to execute, particularly for Unique type Inputs */
    extValidationIsValid?: () => boolean;
    enableSubmit?: boolean;
    setFormDataRef?: (utils: { getValues: UseFormGetValues<T> }) => void;
}

export interface FormError {
    name: string;
    error: FieldError;
}

export const FormModal = forwardRef(function FormModal<T extends FieldValues>(
    {
        title,
        inputs,
        onSubmit,
        defaultValues,
        showCancel = false,
        submitText,
        extValidationIsValid = () => true,
        onClose,
        error,
        enableSubmit = true,
        setFormDataRef
    }: FormModalProps<T>,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const {
        register,
        reset,
        handleSubmit,
        setError,
        getValues,
        formState: { errors }
    } = useForm<T>({ defaultValues: defaultValues });
    useEffect(() => {
        //used for setting form data reference if needed for validation
        if (setFormDataRef) {
            setFormDataRef({ getValues });
        }
    }, [setFormDataRef]);
    const { setTourState } = useTourContext();

    useEffect(() => {
        reset(defaultValues);
    }, [defaultValues, reset]);

    useEffect(() => {
        if (error) {
            setError(error.name as 'root' | `root.${string}`, error.error);
        }
    }, [error, setError]);

    const onSubmitHandler: SubmitHandler<T> = async (data) => {
        const response = await onSubmit(data);
        if (response instanceof Error) return;
        else reset();
    };

    useEffect(() => {
        setTourState({
            stepIndex: targetToStepIndexMap['#navigate-homepage'],
            target: '#navigate-homepage'
        });
    }, []);

    return (
        <dialog
            ref={ref}
            className="modal"
            onClose={() => {
                reset();
                onClose?.();
            }}
        >
            <div className="modal-box">
                <CloseX close={() => void reset()} />
                <div className="flex flex-col">
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        {title}
                    </span>
                    <form
                        key={inputs.length}
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (extValidationIsValid())
                                void handleSubmit(onSubmitHandler)(e);
                        }}
                    >
                        {inputs.map(
                            (input: Input | InputWithOptions<T>, index) => {
                                if (input.type === FormInputTypes.Text) {
                                    return (
                                        <TextInput
                                            key={index}
                                            label={input.label}
                                            interfaceRef={input.interfaceRef}
                                            required={input.required}
                                            length={input.length}
                                            errors={errors}
                                            register={register}
                                            validate={input.validate}
                                            disabled={input.disabled}
                                            onChange={input.onChange}
                                        />
                                    );
                                }
                                if (input.type === FormInputTypes.Dropdown) {
                                    if (!input.enumType) return;
                                    return (
                                        <DropdownInput
                                            key={index}
                                            label={input.label}
                                            interfaceRef={input.interfaceRef}
                                            required={input.required}
                                            errors={errors}
                                            register={register}
                                            enumType={input.enumType}
                                            disabled={input.disabled}
                                            onChange={input.onChangeSelection}
                                        />
                                    );
                                }
                                if (input.type === FormInputTypes.TextArea) {
                                    return (
                                        <TextAreaInput
                                            key={index}
                                            label={input.label}
                                            interfaceRef={input.interfaceRef}
                                            required={input.required}
                                            length={input.length}
                                            errors={errors}
                                            register={register}
                                            validate={input.validate}
                                            disabled={input.disabled}
                                        />
                                    );
                                }
                                if (input.type === FormInputTypes.Date) {
                                    return (
                                        <DateInput
                                            key={index}
                                            label={input.label}
                                            interfaceRef={input.interfaceRef}
                                            required={input.required}
                                            errors={errors}
                                            register={register}
                                            validate={input.validate}
                                            getValues={input.getValues}
                                            disabled={input.disabled}
                                            allowPastDate={input.allowPastDate}
                                            monthOnly={input.monthOnly}
                                        />
                                    );
                                }
                                if (input.type === FormInputTypes.Time) {
                                    return (
                                        <TimeInput
                                            key={index}
                                            label={input.label}
                                            interfaceRef={input.interfaceRef}
                                            required={input.required}
                                            errors={errors}
                                            register={register}
                                            validate={input.validate}
                                            getValues={input.getValues}
                                            disabled={input.disabled}
                                        />
                                    );
                                }

                                if (
                                    input.type ===
                                        FormInputTypes.MultiSelectDropdown &&
                                    'options' in input
                                ) {
                                    return (
                                        <MultiSelectDropdownInput
                                            key={index}
                                            label={input.label}
                                            options={input.options ?? []}
                                            interfaceRef={'platforms'}
                                            required={input.required}
                                            errors={errors}
                                            register={register}
                                            disabled={input.disabled}
                                        />
                                    );
                                }
                                if (input.type === FormInputTypes.Checkbox) {
                                    return (
                                        <CheckboxInput
                                            label={input.label}
                                            interfaceRef={input.interfaceRef}
                                            required={input.required}
                                            errors={errors}
                                            register={register}
                                        />
                                    );
                                }
                                if (input.type === FormInputTypes.Unique) {
                                    return (
                                        <div key={index}>
                                            {input.uniqueComponent}
                                        </div>
                                    );
                                }
                                return;
                            }
                        )}
                        {showCancel ? (
                            <div className="col-span-4 flex justify-end gap-4 mt-4">
                                <label className="form-control pt-4">
                                    <CancelButton
                                        onClick={() => {
                                            reset();
                                            (
                                                ref as React.RefObject<HTMLDialogElement>
                                            )?.current?.close();
                                            onClose?.();
                                        }}
                                    />
                                </label>
                                <div className="pt-4">
                                    <SubmitButton
                                        label={submitText}
                                        isEnabled={enableSubmit}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="pt-4">
                                <SubmitButton
                                    label={submitText}
                                    isEnabled={enableSubmit}
                                />
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </dialog>
    );
});
export default FormModal;
