import { termsSections } from "./terms-sections.data";

export function TermsDocument() {
  return (
    <article className="legal-document legal-document--numbered">
      {termsSections.map(({ number, title, copy }) => (
        <section key={number}>
          <span>{number}</span>
          <div>
            <h2>{title}</h2>
            <p>{copy}</p>
          </div>
        </section>
      ))}
    </article>
  );
}
