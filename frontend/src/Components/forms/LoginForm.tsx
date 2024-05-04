import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import Checkbox from "../../Components/inputs/Checkbox";
import InputError from "../../Components/inputs/InputError";
import PrimaryButton from "../../Components/PrimaryButton";
import { TextInput } from "../../Components/inputs/TextInput";
type Inputs = {
  username: string;
  password: string;
  remember: boolean;
};

export default function LoginForm() {
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
      const response = await window.axios.post("/api/login", data);
      const user = response.data;
      if (user.reset_password) {
        window.location.replace("reset-password");
        return;
      }
      window.location.replace("dashboard");
    } catch (error: any) {
      setProcessing(false);
      setErrorMessage(error.response);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <TextInput
        label={"Username"}
        interfaceRef={"username"}
        required={true}
        length={50}
        errors={errors}
        register={register}
      />

      <TextInput
        label={"Password"}
        interfaceRef={"password"}
        required={true}
        length={50}
        errors={errors}
        register={register}
        password={true}
      />

      {errorMessage && (
        <div className="block">
          <InputError message={errorMessage} className="pt-2" />
        </div>
      )}

      <div className="block mt-4 ml-2">
        <label className="flex items-center">
          <Checkbox
            label={"Remember me"}
            interfaceRef={"remember"}
            register={register}
          />
        </label>
      </div>

      <div className="flex items-center justify-end mt-4">
        <PrimaryButton className="ms-4 w-24 h-10" disabled={processing}>
          {processing ? (
            <span className="loading loading-spinner loading-sm mx-auto"></span>
          ) : (
            <div className="m-auto">Log in</div>
          )}
        </PrimaryButton>
      </div>
    </form>
  );
}
