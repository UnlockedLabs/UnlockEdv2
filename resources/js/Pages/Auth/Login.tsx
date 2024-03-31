import axios from "axios";
import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import Checkbox from "@/Components/inputs/Checkbox";
import GuestLayout from "@/Layouts/GuestLayout";
import InputError from "@/Components/InputError";
import PrimaryButton from "@/Components/PrimaryButton";
import { TextInput } from "@/Components/inputs/TextInput";
import { Head, Link } from "@inertiajs/react";
type Inputs = {
    username: string;
    password: string;
    remember: boolean;
};

export default function Login({ status }: { status?: string }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [processing, setProcessing] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<Inputs>();

    const submit: SubmitHandler<Inputs> = async (data) => {
        try {
            setErrorMessage("");
            setProcessing(true);
            await axios.post(route("login", data));
            window.location.replace(route("dashboard"));
        } catch (error: any) {
            setProcessing(false);
            setErrorMessage(error.response.data.message);
        }
    };

    return (
        <GuestLayout>
            <Head title="Log in" />
            {status && (
                <div className="mb-4 font-medium text-sm text-green-600">
                    {status}
                </div>
            )}

            <form onSubmit={handleSubmit(submit)}>
                <div className="mt-4">
                    <TextInput
                        label={"Username"}
                        interfaceRef={"username"}
                        required={true}
                        length={50}
                        errors={errors}
                        register={register}
                    />
                    <div className="h-6">
                        <InputError message={errorMessage} className="pt-2" />
                    </div>
                </div>

                <div className="mt-4">
                    <TextInput
                        label={"Password"}
                        interfaceRef={"password"}
                        required={true}
                        length={50}
                        errors={errors}
                        register={register}
                        password={true}
                    />
                </div>

                <div className="block mt-4">
                    <label className="flex items-center">
                        <Checkbox
                            label={"Remember me"}
                            interfaceRef={"remember"}
                            register={register}
                        />
                    </label>
                </div>

                <div className="flex items-center justify-end mt-4">
                    <PrimaryButton className="ms-4" disabled={processing}>
                        Log in
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
