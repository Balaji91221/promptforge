export function StatTile({
  label, value, foot, tone,
}: {
  label: string;
  value: string;
  foot?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className={`value${tone ? " " + tone : ""}`}>{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}
