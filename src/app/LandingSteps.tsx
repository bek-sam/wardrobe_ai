import { steps } from "./landing-steps.data";

export function LandingSteps() {
  return (
    <section className="landing-intro" id="how-it-works">
      <p className="eyebrow">A quieter way to get dressed</p>
      <h2>Your clothes become a useful system, not another gallery to maintain.</h2>
      <div className="landing-steps">
        {steps.map(({ number, icon: Icon, title, copy }) => (
          <article key={number}>
            <div>
              <span>{number}</span>
              <Icon size={25} weight="light" aria-hidden="true" />
            </div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
