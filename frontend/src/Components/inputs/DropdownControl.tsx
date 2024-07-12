interface DropdownControlProps {
  label?: string;
  callback: Function;
  enumType: Record<string, string>;
}

/* a dropdown that executes a callback function on change */
export default function DropdownControl({
  label,
  callback,
  enumType,
}: DropdownControlProps) {
  return (
    <label className="form-control">
      <select
        className="select select-bordered"
        onChange={(e) => callback(e.target.value)}
      >
        {label ? (
          <option value="" disabled selected>
            {label}
          </option>
        ) : (
          ""
        )}
        {Object.entries(enumType).map(([key, value]) => (
          <option key={key} value={value}>
            {key}
          </option>
        ))}
      </select>
    </label>
  );
}
