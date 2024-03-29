import { User, UserRole } from "@/common";
import axios from "axios";
import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { CloseX } from "../inputs/CloseX";
import { TextInput } from "../inputs/TextInput";
import { DropdownInput } from "../inputs/DropdownInput";
import { SubmitButton } from "../inputs/SubmitButton";

type Inputs = {
    name_first: string;
    name_last: string;
    username: string;
    role: UserRole;
    email: string;
};

export default function EditUserForm({
    onSuccess,
    user,
}: {
    onSuccess: () => void;
    user: null | User;
}) {
    if (user === null) {
        return <div>No user defined!</div>;
    }

    const [errorMessage, setErrorMessage] = useState("");

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<Inputs>({
        defaultValues: {
            name_first: user.name_first,
            name_last: user.name_last,
            username: user.username,
            role: user.role as UserRole,
            email: user.email,
        },
    });

    function diffFormData(formData: any, currentUserData: any) {
        const changes: Partial<User> = {};
        Object.keys(formData).forEach((key) => {
            if (
                formData[key] !== currentUserData[key] &&
                formData[key] !== undefined
            ) {
                changes[key] = formData[key];
            }
        });
        return changes;
    }

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        try {
            setErrorMessage("");
            const cleanData = diffFormData(data, user);
            await axios.patch(`/api/v1/users/${user.id}`, cleanData);

            onSuccess();
        } catch (error: any) {
            setErrorMessage(error.response.data.message);
        }
    };

    return (
        <>
            <CloseX close={() => onSuccess()} />
            <form onSubmit={handleSubmit(onSubmit)}>
                <TextInput
                    label={"First Name"}
                    interfaceRef={"name_first"}
                    required={true}
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={"Last Name"}
                    interfaceRef={"name_last"}
                    required={true}
                    length={25}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={"Username"}
                    interfaceRef={"username"}
                    required={true}
                    length={50}
                    errors={errors}
                    register={register}
                />
                <TextInput
                    label={"Email"}
                    interfaceRef={"email"}
                    required={false}
                    length={50}
                    errors={errors}
                    register={register}
                />
                <DropdownInput
                    label={"Role"}
                    interfaceRef={"role"}
                    required={true}
                    errors={errors}
                    register={register}
                    enumType={UserRole}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </>
    );
}
