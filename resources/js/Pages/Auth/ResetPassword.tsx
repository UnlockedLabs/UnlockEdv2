import axios from "axios";
import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import GuestLayout from "@/Layouts/GuestLayout";
import InputError from "@/Components/InputError";
import Spinner from "@/Components/Spinner";
import PrimaryButton from "@/Components/PrimaryButton";
import { TextInput } from "@/Components/inputs/TextInput";
import { Head } from "@inertiajs/react";
type Inputs = {
    password: string;
    confirmation: string;
};

export default function ResetPassword() {
    const [errorMessage, setErrorMessage] = useState("");
    const [processing, setProcessing] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<Inputs>();

    const submit: SubmitHandler<Inputs> = async (data) => {
        try {
            setErrorMessage("");
            setProcessing(true);
            await axios.post(route("password.update", data));
            window.location.replace(route("dashboard"));
        } catch (error: any) {
            setProcessing(false);
            setErrorMessage(error.response.data.message);
            reset();
        }
    };

    return (
        <GuestLayout>
            <Head title="Reset Password" />

            <form onSubmit={handleSubmit(submit)}>
                <div className="mt-4">
                    <TextInput
                        label={"password"}
                        labelText={"New Password"}
                        interfaceRef={"password"}
                        length={50}
                        required={true}
                        errors={errors}
                        register={register}
                        password={true}
                        autoComplete="new-password"
                        isFocused={true}
                    />

                    <div className="h-6">
                        <InputError message={errorMessage} className="pt-2" />
                    </div>
                </div>

                <div className="mt-4">
                    <TextInput
                        label={"confirm"}
                        labelText={"Confirm Password"}
                        interfaceRef={"password_confirmation"}
                        length={50}
                        required={true}
                        errors={errors}
                        register={register}
                        password={true}
                        autoComplete="new-password"
                    />
                </div>

                <div className="flex items-center justify-end mt-4">
                    <PrimaryButton
                        className="ms-4 w-40 h-10"
                        disabled={processing}
                    >
                        {processing ? (
                            <Spinner extraClasses="m-auto" />
                        ) : (
                            <div className="m-auto">Reset Password</div>
                        )}
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
