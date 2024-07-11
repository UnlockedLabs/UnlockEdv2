import { OutcomePillType } from "../CatalogCourseCard";

export default function OutcomePill({
  outcome,
  children,
}: {
  outcome: OutcomePillType;
  children: any;
}) {
  return (
    <div className="flex">
      <p className="catalog-pill bg-grey-1 text-body-text">
        {outcome == OutcomePillType.Certificate
          ? "Certificate"
          : outcome == OutcomePillType.CollegeCredit
            ? "College Credit"
            : children}
      </p>
    </div>
  );
}
