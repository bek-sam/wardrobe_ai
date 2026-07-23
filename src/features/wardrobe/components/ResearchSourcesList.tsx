import type { ResearchSource } from "./item-detail.types";

export function ResearchSourcesList({ sources }: { sources: ResearchSource[] }) {
  if (!sources.length) return null;
  return (
    <ul className="research-source-list">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.title || source.domain}
          </a>{" "}
          <small>{source.source_type}</small>
        </li>
      ))}
    </ul>
  );
}
