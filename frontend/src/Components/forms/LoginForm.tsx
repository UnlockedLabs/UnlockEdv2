import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import Checkbox from '../../Components/inputs/Checkbox';
import InputError from '../../Components/inputs/InputError';
import PrimaryButton from '../../Components/PrimaryButton';
import { TextInput } from '../../Components/inputs/TextInput';
import axios from 'axios';

type Inputs = {
  identifier: string;
  password: string;
  challenge?: string;
};

export default function LoginForm() {
  const [errorMessage, setErrorMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<Inputs>();

  const submit: SubmitHandler<Inputs> = async (data) => {
    try {
      const loginData = await initLoginFlow();
      loginData["password"] = data.password;
      loginData["username"] = data.identifier;
      setErrorMessage("");
      setProcessing(true);
      const resp = await axios.post("/api/login", loginData);
      if (resp.status === 200) {
        let location = resp.data.redirect_to;
        if (!location) {
          location = resp.data.redirect_browser_to;
        }
        console.log("Redirecting to", location);
        window.location.replace(location);
        return;
      }
      return;
    } catch (error: any) {
      if (error.response.data.redirect_browser_to) {
        window.location.replace(error.response.data.redirect_browser_to);
        return;
      }
      setProcessing(false);
      setErrorMessage("Login failed, please try again");
    }
  };

  const initLoginFlow = async () => {
    try {
      const queryParams = new URLSearchParams(window.location.search);
      if (!queryParams.has("flow")) {
        setErrorMessage("No login flow specified");
        window.location.replace("/self-service/login/browser");
        return;
      }
      let url = "/self-service/login/flows?id=" + queryParams.get("flow");
      const resp = await axios.get(url);
      if (resp.status !== 200) {
        console.error("Error initializing login flow");
        return;
      }
      const attributes = {
        flow_id: resp.data.id,
        challenge: resp.data.oauth2_login_challenge,
        csrf_token: resp.data.ui.nodes[0].attributes.value,
      };
      return attributes;
    } catch (error) {
      setErrorMessage(
        "Error initializing login flow, please refresh the page and try again",
      );
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
        label={'Password'}
        interfaceRef={'password'}
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
            label={'Remember me'}
            interfaceRef={'remember'}
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
