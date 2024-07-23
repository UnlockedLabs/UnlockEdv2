import { ProviderPlatform, UserRole } from "../../common";
import axios from "axios";
import { useEffect, useState } from "react";
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
  const [providers, setProviders] = useState<ProviderPlatform[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<number[]>([]);
  const {
    reset,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    try {
      setErrorMessage("");
      const response = await axios.post("/api/users", {
        user: data,
        provider_platforms: selectedProviders,
      });

      if (response.status !== 201) {
        onSuccess("", "Failed to create user", ToastState.error);
      }
      reset();
      onSuccess(
        response.data.temp_password,
        "User created successfully with temporary password",
        ToastState.success
      );
    } catch (error: any) {
      setErrorMessage(error.response.data.message);
    }
  };

  const handleAddUserToProviderList = (providerId: number) => {
    if (selectedProviders.includes(providerId)) {
      setSelectedProviders(selectedProviders.filter((id) => id !== providerId));
    } else {
      setSelectedProviders([...selectedProviders, providerId]);
    }
  };

  useEffect(() => {
    const fetchActiveProviders = async () => {
      try {
        const resp = await axios.get(
          `/api/provider-platforms?only=oidc_enabled`
        );
        if (resp.status === 200) {
          setProviders(resp.data.data);
        }
      } catch (error: any) {
        setErrorMessage(error.response.data.message);
      }
    };
    fetchActiveProviders();
  }, []);

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
        <br />
        {providers &&
          providers.map((provider: ProviderPlatform) => (
            <div
              className="tooltip"
              data-tip="Also create account in provider platform"
              key={provider.id}
            >
              <div className="justify-items-center">
                Create New Account for User in:
              </div>
              <div className="form-control">
                <label className="label cursor-pointer gap-2">
                  <label className="badge-md">{provider.name}</label>
                  <input
                    type="checkbox"
                    className="checkbox"
                    onChange={() => handleAddUserToProviderList(provider.id)}
                  />
                </label>
              </div>
            </div>
          ))}
        <SubmitButton errorMessage={errorMessage} />
      </form>
    </div>
  );
}
