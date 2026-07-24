export function PrivacyDocument() {
  return (
    <article className="legal-document">
      <section>
        <h2>What we expect to collect</h2>
        <p>
          Account information, optional profile and size preferences, wardrobe metadata, images you
          choose to upload, saved outfits, plans, feedback, and wear history. Sensitive profile
          fields are optional.
        </p>
      </section>
      <section>
        <h2>How AI is used</h2>
        <p>
          Selected images and wardrobe context may be sent to configured AI providers to analyze
          garments, create approved image edits, research products, and build outfit
          recommendations. Hidden model reasoning is not stored.
        </p>
      </section>
      <section>
        <h2>Location and weather</h2>
        <p>
          When enabled, approximate coordinates and dates are used to retrieve weather context.
          Location can be edited or removed in Settings.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can correct AI metadata, decline modeled previews, remove original images while
          preserving manual details, export your data, and request account deletion.
        </p>
      </section>
      <section>
        <h2>Before private beta</h2>
        <p>
          The final policy will identify data processors, retention periods, contact details,
          regional rights, and the production deletion timeline.
        </p>
      </section>
    </article>
  );
}
