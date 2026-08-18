import { LegalHeader } from "@/components/ui";

export const metadata = { title: "Terms" };

const termsSections = [
  {
    number: "01",
    title: "Your account",
    copy: "You are responsible for accurate account details and for keeping access credentials secure. Do not share another person’s private images without their permission.",
  },
  {
    number: "02",
    title: "AI-assisted results",
    copy: "Garment identification, materials, product research, weather guidance, and outfit suggestions may be incomplete or incorrect. Review recommendations before relying on them.",
  },
  {
    number: "03",
    title: "Your content",
    copy: "You retain rights to content you upload. You grant the service the limited permission necessary to store, process, and display it for your account.",
  },
  {
    number: "04",
    title: "Acceptable use",
    copy: "Do not use the service to violate privacy, intellectual-property rights, laws, or platform safeguards, or to process images without appropriate consent.",
  },
  {
    number: "05",
    title: "Availability",
    copy: "Private-beta features may change, pause, or fail. Expensive AI features may have per-account limits that are shown before use.",
  },
  {
    number: "06",
    title: "Ending service",
    copy: "You may delete your account through Settings when production deletion is enabled. Final terms will describe suspension, termination, and retention details.",
  },
] as const;

function TermsDocument() {
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

export default function TermsPage() {
  return (
    <div className="legal-page">
      <LegalHeader />
      <main className="legal-main legal-main--narrow">
        <div className="legal-title">
          <p className="eyebrow">Private beta draft</p>
          <h1>Terms of use.</h1>
          <p>
            These draft terms describe the intended product experience. They require final legal
            review before Wardrobe AI accepts public accounts.
          </p>
        </div>
        <TermsDocument />
      </main>
    </div>
  );
}
