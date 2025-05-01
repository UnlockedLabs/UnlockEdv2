export function SubmitButton({
    errorMessage,
    label = 'Submit',
    isEnabled
}: {
    errorMessage?: string;
    label?: string;
    isEnabled?: boolean;
}) {
    return (
        <label className="form-control pt-4">
            <input
                className="btn btn-primary"
                type="submit"
                value={label}
                disabled={!isEnabled}
            />
            {errorMessage ? (
                <div className="text-error text-center pt-2">
                    {errorMessage}
                </div>
            ) : undefined}
        </label>
    );
}
