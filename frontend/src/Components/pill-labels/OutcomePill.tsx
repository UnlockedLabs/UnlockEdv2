import { OutcomePillType } from "../CatalogCourseCard";

export default function OutcomePill({ outcome }: { outcome: OutcomePillType }) {
  return (
    <div className="flex">
      <p className="catalog-pill bg-grey-1 text-body-text">
        {outcome == OutcomePillType.Certificate
          ? "Certificate"
          : outcome == OutcomePillType.CollegeCredit
            ? "College Credit"
            : ""}
      </p>
    </div>
  );
}
