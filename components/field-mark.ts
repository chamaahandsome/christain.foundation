// Minimal port of Maltivas' FieldHighlight: a TipTap mark that preserves
// <span data-field="key"> input sections through the editor and styles
// them as fill-in chips. `filledBy` mirrors the Maltivas Field Settings
// toggle: "creator" fields are set in the editor; "recipient" fields are
// asked of the signer on the signing page.

import { Mark, mergeAttributes } from "@tiptap/core";

export const FieldMark = Mark.create({
  name: "fieldMark",

  addAttributes() {
    return {
      field: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-field"),
        renderHTML: (attributes) =>
          attributes.field ? { "data-field": attributes.field } : {},
      },
      filledBy: {
        default: "creator",
        parseHTML: (element) => element.getAttribute("data-filled-by") ?? "creator",
        renderHTML: (attributes) =>
          attributes.filledBy && attributes.filledBy !== "creator"
            ? { "data-filled-by": attributes.filledBy }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-field]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});
