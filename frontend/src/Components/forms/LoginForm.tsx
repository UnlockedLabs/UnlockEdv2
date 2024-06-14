import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import Checkbox from "../../Components/inputs/Checkbox";
import InputError from "../../Components/inputs/InputError";
import PrimaryButton from "../../Components/PrimaryButton";
import { TextInput } from "../../Components/inputs/TextInput";
import axios from "axios";

type Inputs = {
  identifier: string;
  method: string;
  password: string;
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
      let kratosData = { identifier: data.identifier, password: data.password };
      const urlParams = new URLSearchParams(window.location.search);
      const login_challenge = urlParams.get("login_challenge");
      const login_flow = urlParams.get("flow");
      if (!login_flow) {
        console.error("No kratos login flow found");
        window.location.replace("/");
        return;
      }
      const flow_response = await axios.get(
        "/self-service/login/flows?id=" + login_flow,
      );
      setErrorMessage("");
      setProcessing(true);
      const url = "/self-service/login?flow=" + login_flow;
      if (login_challenge) {
        kratosData["method"] = "oidc";
      } else {
        kratosData["method"] = "password";
      }
      const cookie = flow_response.data.ui.nodes[0].attributes.value;
      kratosData["csrf_token"] = cookie;
      const response = await axios(url, {
        method: "POST",
        data: kratosData,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": cookie,
        },
      });
      if (response.data.session.active) {
        const loginResp = await axios.post("/api/login", {
          username: data.identifier,
          password: data.password,
        });
        const user = loginResp.data;
        if (user.reset_password) {
          window.location.replace("reset-password");
          return;
        } else if (response.status === 200) {
          window.location.replace("/dashboard");
          return;
        }
      } else {
        setErrorMessage("Login failed, session is not active");
      }
    } catch (error: any) {
      setProcessing(false);
      setErrorMessage(error.response.data);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <TextInput
        label={"Username"}
        interfaceRef={"identifier"}
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
