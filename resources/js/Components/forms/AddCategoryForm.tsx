import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

type Inputs = {
    title: string;
};

export default function AddCategoryForm({
    onSuccess,
}: {
    onSuccess: (title: string) => void;
}) {
    const [errorMessage, setErrorMessage] = useState("");

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<Inputs>();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        onSuccess(data.title);
        reset();
    };

    return (
        <div>
            <form method="dialog">
                <button
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                    onClick={() => reset()}
                >
                    ✕
                </button>
            </form>
            <form onSubmit={handleSubmit(onSubmit)}>
                <label className="form-control">
                    <div className="label">
                        <span className="label-text">Title</span>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        {...register("title", {
                            required: "Title is required",
                            maxLength: {
                                value: 25,
                                message:
                                    "Title should be 25 characters or less",
                            },
                        })}
                    />
                    <div className="text-error text-sm">
                        {errors.title && errors.title?.message}
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
