import { UserRole } from "../../common";
import axios from "axios";
import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { ToastState } from "../Toast";
import { CloseX } from "../inputs/CloseX";
import { TextInput } from "../inputs/TextInput";
import { DropdownInput } from "../inputs/DropdownInput";
import { SubmitButton } from "../inputs/SubmitButton";

type Inputs = {
  name_first: string;
  name_last: string;
  username: string;
  role: UserRole;
};

export default function AddUserForm({
  onSuccess,
}: {
  onSuccess: (psw: string, msg: string, err: ToastState) => void;
}) {
  const [errorMessage, setErrorMessage] = useState("");

  const {
    reset,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    try {
      setErrorMessage("");

      let response = await axios.post("/api/users", data);

      if (response.status !== 201) {
        onSuccess("", "Failed to create user", ToastState.error);
      }
      reset();
      onSuccess(
        response.data.temp_password,
        "User created successfully with temporary password",
        ToastState.success,
      );
    } catch (error: any) {
      setErrorMessage(error.response.data.message);
    }
  };

  return (
    <div>
      <CloseX close={() => reset()} />
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
    </div>
  );
}
