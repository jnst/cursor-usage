export function SummaryCards({
  cards,
}: {
  cards: { label: string; value: string; sub: string }[];
}) {
  return (
    <div className="cards">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className="value">{c.value}</div>
          <div className="sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
