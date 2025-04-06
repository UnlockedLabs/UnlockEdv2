export function SubmitButton({
    errorMessage,
    label = 'Submit'
}: {
    errorMessage?: string;
    label?: string;
}) {
    return (
        <label className="form-control pt-4">
            <input className="btn btn-primary" type="submit" value={label} />

            {errorMessage ? (
                <div className="text-error text-center pt-2">
                    {errorMessage}
                </div>
            ) : undefined}
        </label>
    );
}
