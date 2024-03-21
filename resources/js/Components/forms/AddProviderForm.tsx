import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
} from "@/common";
import axios from "axios";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

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

export default function AddProviderForm({
    onSuccess,
}: {
    onSuccess: Function;
}) {
    const [errorMessage, setErrorMessage] = useState("");

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProviderInputs>();

    const onSubmit: SubmitHandler<ProviderInputs> = async (data) => {
        try {
            setErrorMessage("");
            await axios.post("/api/v1/provider-platforms", data);
            onSuccess();
            reset();
        } catch (error: any) {
            setErrorMessage(error.response.data.message);
        }
    };

    return (
        <div>
            <form method="dialog">
                <button
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                    onClick={() => {
                        reset();
                    }}
                >
                    ✕
                </button>
            </form>
            <form onSubmit={handleSubmit(onSubmit)}>
                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Provider Name:</span>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        defaultValue=""
                        {...register("name", {
                            required: "Provider name is required",
                            maxLength: {
                                value: 25,
                                message:
                                    "Provider name should be 25 characters or less",
                            },
                        })}
                    />
                    <div className="text-error text-sm">
                        {errors.name && errors.name?.message}
                    </div>
                </label>

                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Description</span>
                    </div>
                    <textarea
                        className="textarea textarea-bordered w-full"
                        defaultValue=""
                        {...register("description", {
                            required: "Description is required",
                            maxLength: {
                                value: 255,
                                message:
                                    "Description should be 255 characters or less",
                            },
                        })}
                    />
                    <div className="text-error text-sm">
                        {errors.description && errors.description?.message}
                    </div>
                </label>

                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text">Type</span>
                    </div>
                    <select
                        className="select select-bordered"
                        {...register("type", { required: "Type is required" })}
                    >
                        {Object.keys(ProviderPlatformType).map((key) => (
                            <option
                                key={key}
                                value={
                                    ProviderPlatformType[
                                        key as keyof typeof ProviderPlatformType
                                    ]
                                }
                            >
                                {
                                    ProviderPlatformType[
                                        key as keyof typeof ProviderPlatformType
                                    ]
                                }
                            </option>
                        ))}
                    </select>
                    <div className="text-error text-sm">
                        {errors.type && errors.type?.message}
                    </div>
                </label>

                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text">State </span>
                    </div>
                    <select
                        className="select select-bordered"
                        {...register("state", {
                            required: "State is required",
                        })}
                    >
                        {Object.keys(ProviderPlatformState).map((key) => (
                            <option
                                key={key}
                                value={
                                    ProviderPlatformState[
                                        key as keyof typeof ProviderPlatformState
                                    ]
                                }
                            >
                                {
                                    ProviderPlatformState[
                                        key as keyof typeof ProviderPlatformState
                                    ]
                                }
                            </option>
                        ))}
                    </select>
                    <div className="text-error text-sm">
                        {errors.state && errors.state?.message}
                    </div>
                </label>

                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Base URL</span>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        {...register("base_url", {
                            required: "Base URL is required",
                        })}
                    />
                    <div className="text-error text-sm">
                        {errors.base_url && errors.base_url?.message}
                    </div>
                </label>

                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Account Id</span>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        {...register("account_id", {
                            required: "Account Id is required",
                        })}
                    />
                    <div className="text-error text-sm">
                        {errors.account_id && errors.account_id?.message}
                    </div>
                </label>

                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Access Key</span>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        {...register("access_key", {
                            required: "Access key is required",
                        })}
                    />
                    <div className="text-error text-sm">
                        {errors.access_key && errors.access_key?.message}
                    </div>
                </label>

                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Icon URL</span>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        {...register("icon_url")}
                    />
                    <div className="text-error text-sm">
                        {errors.icon_url && errors.icon_url?.message}
                    </div>
                </label>

                <label className="form-control pt-4">
                    <input className="btn btn-primary" type="submit" />
                    <div className="text-error text-center pt-2">
                        {errorMessage}
                    </div>
                </label>
            </form>
        </div>
    );
}
