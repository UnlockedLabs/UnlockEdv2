import { useEffect, useState } from "react";
import { useForm, useWatch, SubmitHandler } from "react-hook-form";
import InputError from "../../Components/inputs/InputError";
import PrimaryButton from "../../Components/PrimaryButton";
import { TextInput } from "../../Components/inputs/TextInput";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

import axios from "axios";
import { useAuth } from "@/AuthContext";
type Inputs = {
  password: string;
  confirm: string;
  facility_name: string;
};

export default function ChangePasswordForm() {
  const [errorMessage, setErrorMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [isFacilityDefault, setIsFacilityDefault] = useState(null);
  const auth = useAuth();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Inputs>();

  const password = useWatch({
    control,
    name: "password",
  });

  const confirm = useWatch({
    control,
    name: "confirm",
  });

  const facility = useWatch({
    control,
    name: "facility_name",
  });
  useEffect(() => {
    const checkFacilityName = async () => {
      try {
        const resp = await axios.get("/api/facilities/1");
        if (resp.status === 200) {
          setIsFacilityDefault(resp.data.data[0].name === "Default");
          return;
        }
      } catch (error: any) {
        setIsFacilityDefault(false);
      }
    };
    checkFacilityName();
  }, []);

  const isLengthValid = password && password.length >= 8;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirm;
  const isValid = isLengthValid && hasNumber && passwordsMatch;
  const validFacility =
    facility &&
    facility.length > 2 &&
    facility.trim().length === facility.length;
  const isFirstAdminLogin =
    auth.user.id === 1 && auth.user.role === "admin" && isFacilityDefault;

  const submit: SubmitHandler<Inputs> = async (data) => {
    try {
      setErrorMessage("");
      setProcessing(true);
      const response = await axios.post("/api/reset-password", data);
      if (response.status === 200) {
        window.location.replace("dashboard");
      } else {
        setErrorMessage(`Your passwords did not pass validation, 
        please check that they match and are 8 or more characters with at least 1 number.`);
      }
    } catch (error: any) {
      setProcessing(false);
      setErrorMessage(
        error.response.data ||
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

      <div className="mt-2 text-sm">
        <p
          className={`flex items-center ${isLengthValid ? "text-success" : "text-error"}`}
        >
          {isLengthValid ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <XMarkIcon className="h-5 w-5" />
          )}{" "}
          Password is 8 or more characters
        </p>
        <p
          className={`flex items-center ${hasNumber ? "text-success" : "text-error"}`}
        >
          {hasNumber ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <XMarkIcon className="h-5 w-5" />
          )}{" "}
          Password includes at least one number
        </p>
      </div>

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

      <div className="mt-2 text-sm">
        <p
          className={`flex items-center ${passwordsMatch ? "text-success" : "text-error"}`}
        >
          {passwordsMatch ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <XMarkIcon className="h-5 w-5" />
          )}{" "}
          Passwords match
        </p>
      </div>

      {errorMessage && (
        <div className="block">
          <InputError message={errorMessage} className="pt-2" />
        </div>
      )}

      {isFirstAdminLogin && (
        <>
          <div className="mt-2 text-sm">
            <p
              className={`flex items-center ${validFacility ? "text-success" : "text-error"}`}
            >
              {validFacility ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <XMarkIcon className="h-5 w-5" />
              )}{" "}
              Valid Facility Name
            </p>
          </div>

          <TextInput
            label={"New Default Facility Name"}
            interfaceRef={"facility_name"}
            length={50}
            required={true}
            errors={errors}
            register={register}
            password={false}
            autoComplete=""
          />
        </>
      )}

      <div className="flex items-center justify-end mt-4">
        <PrimaryButton
          className="ms-4 w-44 h-10"
          disabled={processing || !isValid}
        >
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
