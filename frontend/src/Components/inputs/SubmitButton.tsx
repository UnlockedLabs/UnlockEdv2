export function SubmitButton({
    errorMessage,
    label = 'Submit',
    isEnabled = true
}: {
    errorMessage?: string;
    label?: string;
    isEnabled?: boolean;
}) {
    return (
        <label className="form-control">
            <input
                className="button"
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
