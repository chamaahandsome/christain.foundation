// Inline signature-field node (the Maltivas signature-bubble): an atom
// chip placed in the document that a signer's signature replaces — the
// creator's at send time, each recipient's at their signing time. A
// client chip can carry an email assignment (data-email/data-signer-name);
// every unique assigned email gets its own signing token at send, and
// chips without an email belong to the default client recipient.

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    signatureField: {
      insertSignatureField: (signer: "creator" | "client") => ReturnType;
    };
  }
}

export const SignatureField = Node.create({
  name: "signatureField",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      signer: {
        default: "client",
        parseHTML: (el) => el.getAttribute("data-signer") ?? "client",
        renderHTML: (attrs) => ({ "data-signer": attrs.signer }),
      },
      email: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-email"),
        renderHTML: (attrs) => (attrs.email ? { "data-email": attrs.email } : {}),
      },
      signerName: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-signer-name"),
        renderHTML: (attrs) =>
          attrs.signerName ? { "data-signer-name": attrs.signerName } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-signature-field]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label =
      node.attrs.signer === "creator"
        ? "Your signature"
        : node.attrs.signerName ||
          (node.attrs.email as string | null) ||
          "Client signature";
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-signature-field": "" }),
      `✍️ ${label}`,
    ];
  },

  addCommands() {
    return {
      insertSignatureField:
        (signer) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { signer } }),
    };
  },
});
