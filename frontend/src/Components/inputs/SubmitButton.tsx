export function SubmitButton({ errorMessage }: { errorMessage: string }) {
    return (
        <label className="form-control pt-4">
            <input className="btn btn-primary" type="submit" value="Submit" />
            <div className="text-error text-center pt-2">{errorMessage}</div>
        </label>
    );
}
