export default function ConsentForm() {
  return (
    <div title="Consent Form">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 flex flex-col my-2">
        <h2 className="text-2xl font-bold text-center mb-4">Consent Form</h2>
        <p className="text-center mb-4">
          Do you consent to give this external application access to your
          account?
        </p>
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            type="button"
          >
            Accept
          </button>
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            type="button"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
