// Minimal port of Maltivas' FieldHighlight: a TipTap mark that preserves
// <span data-field="key"> input sections through the editor (TipTap drops
// unknown attributes otherwise) and styles them as fill-in fields. The
// creator just types over the placeholder text; the highlight travels with
// the field until the span is deleted.

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
    };
  },

  parseHTML() {
    return [{ tag: "span[data-field]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});
