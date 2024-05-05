import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { TextInput, CloseX, SubmitButton } from "../inputs";

type Inputs = {
  title: string;
};

export default function AddCategoryForm({
  onSuccess,
}: {
  onSuccess: (title: string) => void;
}) {
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Inputs>();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    onSuccess(data.title);
    reset();
  };

  return (
    <div>
      <CloseX close={() => reset()} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <TextInput
          label="Title"
          interfaceRef="title"
          required={true}
          length={25}
          errors={errors}
          register={register}
        />
        <SubmitButton errorMessage={errorMessage} />
      </form>
    </div>
  );
}
