export default function StatsCard({
  title,
  number,
  label,
}: {
  title: string;
  number: string;
  label: string;
}) {
  return (
    <div className="card bg-base-teal p-4 pb-5">
      <h3 className="text-teal-4">{title.toUpperCase()}</h3>
      <p className="text-teal-3 text-4xl font-bold mt-4">
        {number}
        <span className="text-teal-4 text-base font-bold ml-3">
          {label.toLowerCase()}
        </span>
      </p>
    </div>
  );
}
