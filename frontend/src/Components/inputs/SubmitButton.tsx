export function SubmitButton({ errorMessage }: { errorMessage: string }) {
<<<<<<< HEAD
    return (
        <label className="form-control pt-4">
            <input className="btn btn-primary" type="submit" value="Sumbit" />
            <div className="text-error text-center pt-2">{errorMessage}</div>
        </label>
    );
||||||| parent of d4cd4df (feat: finish openid connect implementation)
  return (
    <label className="form-control pt-4">
      <input className="btn btn-primary" type="submit" value="Sumbit" />
      <div className="text-error text-center pt-2">{errorMessage}</div>
    </label>
  );
=======
  return (
    <label className="form-control pt-4">
      <input className="btn btn-primary" type="submit" value="Submit" />
      <div className="text-error text-center pt-2">{errorMessage}</div>
    </label>
  );
>>>>>>> d4cd4df (feat: finish openid connect implementation)
}
