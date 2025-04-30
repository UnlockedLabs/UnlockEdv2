export function SubmitButton({
    errorMessage,
    label = 'Submit',
    verifyResidentDOCIDMode,
    isEnabled
}: {
    errorMessage?: string;
    label?: string;
    verifyResidentDOCIDMode?: boolean;
    isEnabled?: boolean;
}) {
    return (
        <label className="form-control pt-4">
            <input
                className="btn btn-primary"
                type="submit"
                value={label}
                disabled={verifyResidentDOCIDMode ? !isEnabled : false}
            />
            {errorMessage ? (
                <div className="text-error text-center pt-2">
                    {errorMessage}
                </div>
            ) : undefined}
        </label>
    );
}
