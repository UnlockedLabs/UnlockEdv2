import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import InputError from "../../Components/inputs/InputError";
import PrimaryButton from "../../Components/PrimaryButton";
import { TextInput } from "../../Components/inputs/TextInput";
import axios from "axios";
type Inputs = {
  password: string;
  confirmation: string;
};

export default function ChangePasswordForm() {
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
      const response = await axios.post("/api/reset-password", data);
      if (response.status === 200) {
        window.location.replace("dashboard");
      } else {
        setErrorMessage(`Your passwords did not pass validation, 
        please check that they match and are > 8 characters with at least 1 letter.`);
      }
    } catch (error: any) {
      setProcessing(false);
      setErrorMessage(
        error.response.data.message ||
          "Your passwords didn't pass validation, please try again.",
      );
      reset();
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <TextInput
        label={"New password"}
        interfaceRef={"password"}
        length={50}
        required={true}
        errors={errors}
        register={register}
        password={true}
        autoComplete="new-password"
        isFocused={true}
      />

      <TextInput
        label={"Confirm password"}
        interfaceRef={"confirm"}
        length={50}
        required={true}
        errors={errors}
        register={register}
        password={true}
        autoComplete="new-password"
      />

      {errorMessage && (
        <div className="block">
          <InputError message={errorMessage} className="pt-2" />
        </div>
      )}

      <div className="flex items-center justify-end mt-4">
        <PrimaryButton className="ms-4 w-44 h-10" disabled={processing}>
          {processing ? (
            <span className="loading loading-spinner loading-sm mx-auto"></span>
          ) : (
            <div className="m-auto">Reset Password</div>
          )}
        </PrimaryButton>
      </div>
    </form>
  );
}
