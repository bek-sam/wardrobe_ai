import { ArrowCounterClockwise, Check, Trash } from "@phosphor-icons/react";
import { PARTS, HEX_COLOR } from "./status.js";

export function ReviewEditor({
  job,
  stage,
  draft,
  setDraft,
  regenPrompt,
  setRegenPrompt,
  busy,
  onAction,
}) {
  const asset = job.stages[stage]?.assetUrl;
  const isCrop = stage === "crop";
  const isGarment = stage === "garment";
  const primaryValid = HEX_COLOR.test(draft.color);
  const secondaryValid = !draft.secondaryColor || HEX_COLOR.test(draft.secondaryColor);
  return (
    <div className="import-editor">
      <img
        className="import-editor__preview"
        src={asset}
        alt={
          isCrop ? "Detected item crop" : isGarment ? "Extracted garment" : "Generated modeled look"
        }
      />
      <div className="import-fields">
        <p className="import-editor__stage">
          {isCrop ? "Detected item" : isGarment ? "Garment image" : "Modeled image"}
        </p>
        {isCrop ? (
          <p className="import-card__detail">
            Check that this crop contains the complete intended item. Approving it starts the clean
            garment-image generation.
          </p>
        ) : isGarment ? (
          <>
            <div className="import-field">
              <label htmlFor={`name-${job.id}`}>Name</label>
              <input
                id={`name-${job.id}`}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className="import-field">
              <label htmlFor={`part-${job.id}`}>Category</label>
              <select
                id={`part-${job.id}`}
                value={draft.part}
                onChange={(event) => setDraft({ ...draft, part: event.target.value })}
              >
                {PARTS.map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="import-field">
              <label htmlFor={`primary-${job.id}`}>Primary color</label>
              <div className="import-color-row">
                <input
                  id={`primary-${job.id}`}
                  type="color"
                  value={primaryValid ? draft.color : "#000000"}
                  onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                />
                <input
                  aria-label="Primary color hex"
                  aria-invalid={!primaryValid}
                  value={draft.color}
                  onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                />
              </div>
              {!primaryValid && (
                <small className="import-field-error">
                  Use a six-digit hex color, such as #d8d0c2.
                </small>
              )}
            </div>
            <div className="import-field">
              <label htmlFor={`secondary-${job.id}`}>
                Secondary color <span>optional</span>
              </label>
              <input
                id={`secondary-${job.id}`}
                type="text"
                aria-invalid={!secondaryValid}
                placeholder="#hex or leave blank"
                value={draft.secondaryColor}
                onChange={(event) => setDraft({ ...draft, secondaryColor: event.target.value })}
              />
              {!secondaryValid && (
                <small className="import-field-error">
                  Use a six-digit hex color or leave this empty.
                </small>
              )}
            </div>
            <div className="import-field">
              <label htmlFor={`tags-${job.id}`}>Details</label>
              <input
                id={`tags-${job.id}`}
                value={draft.tags}
                placeholder="casual, cotton, striped"
                onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
              />
            </div>
          </>
        ) : (
          <p className="import-card__detail">
            Approve this editorial image to attach it to the new wardrobe piece, or regenerate it
            with a more specific direction.
          </p>
        )}
        {!isCrop && (
          <div className="import-field import-regenerate-field">
            <label htmlFor={`regenerate-${job.id}-${stage}`}>
              Regeneration direction <span>optional</span>
            </label>
            <textarea
              id={`regenerate-${job.id}-${stage}`}
              rows="3"
              value={regenPrompt}
              onChange={(event) => setRegenPrompt(event.target.value)}
              placeholder={
                isGarment
                  ? "Example: preserve the original zipper and remove the retail tag"
                  : "Example: use a quiet evening street and show the full garment"
              }
            />
          </div>
        )}
        <div className="import-actions">
          <button className="import-button" disabled={busy} onClick={() => onAction("reject")}>
            <Trash size={14} /> Reject
          </button>
          {!isCrop && (
            <button
              className="import-button"
              disabled={busy}
              onClick={() => onAction("regenerate", regenPrompt)}
            >
              <ArrowCounterClockwise size={14} /> Regenerate
            </button>
          )}
          <button
            className="import-button import-button--primary"
            disabled={
              busy || (isGarment && (!draft.name.trim() || !primaryValid || !secondaryValid))
            }
            onClick={() => onAction("approve")}
          >
            <Check size={14} weight="bold" /> {isCrop ? "Use crop" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
