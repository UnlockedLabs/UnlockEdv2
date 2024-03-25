import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
} from "@/common";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import axios from "axios";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import {
    CloseX,
    TextInput,
    TextAreaInput,
    DropdownInput,
    SubmitButton,
} from "./inputs";

type ProviderInputs = {
    name: string;
    type: ProviderPlatformType;
    description: string;
    base_url: string;
    account_id: string;
    access_key: string;
    icon_url: string;
    state: ProviderPlatformState;
};

export default function EditProviderForm({
    onSuccess,
    provider,
}: {
    onSuccess: Function;
    provider: ProviderPlatform;
}) {
    const [errorMessage, setErrorMessage] = useState("");
    const [showAdditionalFields, setShowAdditionalFields] = useState(false);
    const [showAccessKey, setShowAccessKey] = useState(false);
    const [accessKey, setAccessKey] = useState("");
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProviderInputs>({
        defaultValues: {
            name: provider.name,
            description: provider.description,
            type: provider.type,
            base_url: provider.base_url,
            account_id: provider.account_id,
            icon_url: provider.icon_url,
            state: provider.state,
        },
    });

    const getAccessKey = async () => {
        if (showAccessKey) {
            setShowAccessKey(false);
            return;
        }
        if (accessKey) {
            setShowAccessKey(true);
            return;
        }
        try {
            const response = await axios.get(
                `/api/v1/provider-platforms/${provider?.id}?show_key=true`,
            );
            setAccessKey(response.data.data["access_key"]);
            setShowAccessKey(true);
        } catch (error: any) {
            setErrorMessage(error.response.data.message);
        }
    };

    const onSubmit: SubmitHandler<ProviderInputs> = async (data) => {
        console.log(data);
        try {
            setErrorMessage("");

            await axios.patch(
                `/api/v1/provider-platforms/${provider?.id}`,
                data,
            );
            closeAndReset();
        } catch (error: any) {
            setErrorMessage(error.response.data.message);
        }
    };

    function closeAndReset() {
        onSuccess();
        reset();
    }

    return (
        <div>
            <CloseX close={() => closeAndReset()} />
            <form onSubmit={handleSubmit(onSubmit)}>
                <TextInput
                    label="Name"
                    register={register}
                    interfaceRef="name"
                    required={true}
                    length={25}
                    errors={errors}
                />
                <TextAreaInput
                    label="Description"
                    register={register}
                    interfaceRef="description"
                    required={true}
                    length={255}
                    errors={errors}
                />
                <DropdownInput
                    label="Type"
                    register={register}
                    enumType={ProviderPlatformType}
                    interfaceRef="type"
                    required={true}
                    errors={errors}
                />
                <DropdownInput
                    label="State"
                    register={register}
                    enumType={ProviderPlatformState}
                    interfaceRef="state"
                    required={true}
                    errors={errors}
                />

                {/* Button to toggle additional fields */}
                <div className="pt-4">
                    <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() =>
                            setShowAdditionalFields(!showAdditionalFields)
                        }
                    >
                        {showAdditionalFields ? "Show Less" : "Show More"}
                    </button>
                </div>

                <div className={showAdditionalFields ? "contents" : "hidden"}>
                    <TextInput
                        label="Base URL"
                        register={register}
                        interfaceRef="base_url"
                        required={true}
                        length={null}
                        errors={errors}
                    />
                    <TextInput
                        label="Account Id"
                        register={register}
                        interfaceRef="account_id"
                        required={true}
                        length={null}
                        errors={errors}
                    />
                    <label className="form-control">
                        <div className="label">
                            <span className="label-text">Access Key</span>
                        </div>
                        <div className="relative">
                            {showAccessKey ? (
                                <input
                                    type="text"
                                    className="input input-bordered w-full pr-10"
                                    value={accessKey}
                                    {...register("access_key", {
                                        required: "Access Key is required",
                                        value: accessKey,
                                        onChange: (e) =>
                                            setAccessKey(e.target.value),
                                    })}
                                />
                            ) : (
                                <input
                                    type="password"
                                    className="input input-bordered w-full"
                                    value="**********"
                                    readOnly // Make the input read-only when showAccessKey is false
                                />
                            )}
                            {showAccessKey ? (
                                <EyeSlashIcon
                                    className="w-4 z-10 top-4 right-4 absolute"
                                    onClick={() => {
                                        console.log(accessKey),
                                            setAccessKey(accessKey),
                                            setShowAccessKey(false);
                                    }}
                                />
                            ) : (
                                <EyeIcon
                                    className="w-4 z-10 top-4 right-4 absolute"
                                    onClick={getAccessKey}
                                />
                            )}
                        </div>
                        <div className="text-error text-sm">
                            {errors.access_key && errors.access_key?.message}
                        </div>
                    </label>
                    <TextInput
                        label="Icon URL"
                        register={register}
                        interfaceRef="icon_url"
                        required={false}
                        length={null}
                        errors={errors}
                    />
                </div>
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
