import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <BrandMark />
        <Link href="/">
          <ArrowLeft size={15} /> Back home
        </Link>
      </header>
      <main className="legal-main legal-main--narrow">
        <div className="legal-title">
          <p className="eyebrow">Private beta draft</p>
          <h1>Terms of use.</h1>
          <p>
            These draft terms describe the intended product experience. They require final legal
            review before Wardrobe AI accepts public accounts.
          </p>
        </div>
        <article className="legal-document legal-document--numbered">
          <section>
            <span>01</span>
            <div>
              <h2>Your account</h2>
              <p>
                You are responsible for accurate account details and for keeping access credentials
                secure. Do not share another person’s private images without their permission.
              </p>
            </div>
          </section>
          <section>
            <span>02</span>
            <div>
              <h2>AI-assisted results</h2>
              <p>
                Garment identification, materials, product research, weather guidance, and outfit
                suggestions may be incomplete or incorrect. Review recommendations before relying on
                them.
              </p>
            </div>
          </section>
          <section>
            <span>03</span>
            <div>
              <h2>Your content</h2>
              <p>
                You retain rights to content you upload. You grant the service the limited
                permission necessary to store, process, and display it for your account.
              </p>
            </div>
          </section>
          <section>
            <span>04</span>
            <div>
              <h2>Acceptable use</h2>
              <p>
                Do not use the service to violate privacy, intellectual-property rights, laws, or
                platform safeguards, or to process images without appropriate consent.
              </p>
            </div>
          </section>
          <section>
            <span>05</span>
            <div>
              <h2>Availability</h2>
              <p>
                Private-beta features may change, pause, or fail. Expensive AI features may have
                per-account limits that are shown before use.
              </p>
            </div>
          </section>
          <section>
            <span>06</span>
            <div>
              <h2>Ending service</h2>
              <p>
                You may delete your account through Settings when production deletion is enabled.
                Final terms will describe suspension, termination, and retention details.
              </p>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
