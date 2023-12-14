import { useEffect, FormEventHandler } from "react";
import GuestLayout from "@/Layouts/GuestLayout";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import PrimaryButton from "@/Components/PrimaryButton";
import TextInput from "@/Components/TextInput";
import { Head, Link, useForm } from "@inertiajs/react";

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name_first: "",
        name_last: "",
        username: "",
    });
    useEffect(() => {
        reset("username", "name_first", "name_last");
    }, []);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route("register"));
    };

    return (
        <GuestLayout>
            <Head title="Register a new Student" />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="username" value="Student Username" />

                    <TextInput
                        id="username"
                        name="username"
                        value={data.username}
                        className="mt-1 block w-full"
                        autoComplete="username"
                        onChange={(e) => setData("username", e.target.value)}
                        required
                    />

                    <InputError message={errors.username} className="mt-2" />
                </div>
                <div>
                    <InputLabel
                        htmlFor="name_first"
                        value="Student First Name"
                    />

                    <TextInput
                        id="name_first"
                        name="name_first"
                        value={data.name_first}
                        className="mt-1 block w-full"
                        autoComplete="name"
                        isFocused={true}
                        onChange={(e) => setData("name_first", e.target.value)}
                        required
                    />

                    <InputError message={errors.name_first} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="name_last" value="Student Last Name" />

                    <TextInput
                        id="name_last"
                        name="name_last"
                        value={data.name_last}
                        className="mt-1 block w-full border-gray-300 dark:border-slate-600"
                        autoComplete="name"
                        isFocused={true}
                        onChange={(e) => setData("name_last", e.target.value)}
                        required
                    />

                    <InputError message={errors.name_last} className="mt-2" />
                </div>

                <div className="flex items-center justify-end mt-4">
                    <PrimaryButton className="ms-4" disabled={processing}>
                        Register
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
