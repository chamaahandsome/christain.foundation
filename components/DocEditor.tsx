"use client";

// The Do-Biz document editor — the Maltivas contract-editing experience
// rebuilt for CF: a floating pill toolbar over a paper canvas, a "+"
// insert menu (table, rule, image, input field, signature field), and
// click-to-configure bubbles for fields (Field Settings: filled by you
// now, or by the recipient at signing) and signature chips.

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { FieldMark } from "@/components/field-mark";
import { SignatureField } from "@/components/signature-field";

type FieldPopover = {
  kind: "field";
  from: number;
  to: number;
  fieldKey: string;
  filledBy: "creator" | "recipient";
  value: string;
  x: number;
  y: number;
};
type SignaturePopover = {
  kind: "signature";
  pos: number;
  signer: "creator" | "client";
  email: string;
  signerName: string;
  x: number;
  y: number;
};

function slugify(label: string) {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "field"
  );
}

/* ---------- floating toolbar ---------- */

function Tb({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the editor selection
        onClick();
      }}
      className={`rounded-lg px-2 py-1 text-sm leading-none transition-colors disabled:opacity-30 ${
        active ? "bg-amber-500/25 text-amber-300" : "text-neutral-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function FloatingToolbar({ editor, channelId }: { editor: Editor; channelId?: string }) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Clicking anywhere outside the toolbar menus closes them (the menus
  // and their triggers stop propagation below).
  useEffect(() => {
    if (!plusOpen && !styleOpen) return;
    const close = () => {
      setPlusOpen(false);
      setStyleOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [plusOpen, styleOpen]);

  const onFilePicked = useCallback(
    async (file: File | null) => {
      if (!file || !channelId) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("channelId", channelId);
        form.append("file", file);
        const res = await fetch("/api/studio/upload-image", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          window.alert(data.error ?? "Upload failed — try again.");
          return;
        }
        editor.chain().focus().setImage({ src: data.url }).run();
      } finally {
        setUploading(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    },
    [editor, channelId],
  );

  const insertField = useCallback(() => {
    const label = window.prompt(
      "Name this field (what it asks for, e.g. Effective Date)",
      "",
    );
    if (!label?.trim()) return;
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "text",
          text: label.trim(),
          marks: [
            { type: "fieldMark", attrs: { field: slugify(label), filledBy: "creator" } },
          ],
        },
        { type: "text", text: " " },
      ])
      .run();
  }, [editor]);

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://…)", previous ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const styleLabel = editor.isActive("heading", { level: 1 })
    ? "Heading 1"
    : editor.isActive("heading", { level: 2 })
      ? "Heading 2"
      : editor.isActive("heading", { level: 3 })
        ? "Heading 3"
        : editor.isActive("bulletList")
          ? "Bullet List"
          : editor.isActive("orderedList")
            ? "Numbered List"
            : editor.isActive("blockquote")
              ? "Quote"
              : editor.isActive("codeBlock")
                ? "Code"
                : "Paragraph";

  // The Maltivas paragraph-style menu: block styles with colored glyphs.
  const STYLES: { label: string; glyph: string; glyphClass: string; run: () => void; group: number }[] = [
    { label: "Paragraph", glyph: "T", glyphClass: "font-serif text-sky-400", group: 0,
      run: () => editor.chain().focus().setParagraph().run() },
    { label: "Heading 1", glyph: "H₁", glyphClass: "font-semibold text-sky-400", group: 0,
      run: () => editor.chain().focus().setHeading({ level: 1 }).run() },
    { label: "Heading 2", glyph: "H₂", glyphClass: "font-semibold text-sky-400", group: 0,
      run: () => editor.chain().focus().setHeading({ level: 2 }).run() },
    { label: "Heading 3", glyph: "H₃", glyphClass: "font-semibold text-sky-400", group: 0,
      run: () => editor.chain().focus().setHeading({ level: 3 }).run() },
    { label: "Bullet List", glyph: "≔", glyphClass: "text-green-400", group: 1,
      run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered List", glyph: "⒈", glyphClass: "text-green-400", group: 1,
      run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Quote", glyph: "❝", glyphClass: "text-amber-400", group: 1,
      run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Code", glyph: "‹›", glyphClass: "text-amber-400", group: 1,
      run: () => editor.chain().focus().toggleCodeBlock().run() },
  ];

  const plusItem =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/10";
  const divider = <span className="mx-1 h-5 w-px self-center bg-white/15" />;

  return (
    <div className="pointer-events-none sticky top-16 z-30 flex justify-center">
      <div
        data-tour="editor-toolbar"
        className="pointer-events-auto relative flex flex-wrap items-center gap-0.5 rounded-full border border-white/10 bg-neutral-900/95 px-2 py-1.5 shadow-xl shadow-black/20 backdrop-blur"
      >
        {/* + insert menu */}
        <button
          type="button"
          title="Insert"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlusOpen((o) => !o);
          }}
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-lg font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
        >
          +
        </button>
        {plusOpen && (
          <div
            className="absolute left-0 top-11 z-40 w-52 rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              className={plusItem}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run();
                setPlusOpen(false);
              }}
            >
              ▦ Table
            </button>
            <button
              type="button"
              className={plusItem}
              onClick={() => {
                editor.chain().focus().setHorizontalRule().run();
                setPlusOpen(false);
              }}
            >
              — Horizontal rule
            </button>
            <button
              type="button"
              className={plusItem}
              disabled={uploading}
              onClick={() => {
                if (channelId) fileInput.current?.click();
                else {
                  const url = window.prompt("Image URL (https://…)", "https://");
                  if (url && /^https:\/\//i.test(url)) {
                    editor.chain().focus().setImage({ src: url }).run();
                  }
                }
                setPlusOpen(false);
              }}
            >
              🖼 {uploading ? "Uploading…" : "Image"}
            </button>
            <div className="my-1 h-px bg-white/10" />
            <button
              type="button"
              className={plusItem}
              onClick={() => {
                insertField();
                setPlusOpen(false);
              }}
            >
              <span className="font-serif text-amber-400">T</span> Input field
            </button>
            <button
              type="button"
              className={plusItem}
              onClick={() => {
                editor.chain().focus().insertSignatureField("client").run();
                setPlusOpen(false);
              }}
            >
              ✍️ Signature field
            </button>
          </div>
        )}

        {/* Paragraph-style menu */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setStyleOpen((o) => !o);
            setPlusOpen(false);
          }}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-neutral-300 hover:bg-white/10"
        >
          {styleLabel} <span className="text-[10px] text-neutral-500">▾</span>
        </button>
        {styleOpen && (
          <div
            className="absolute left-10 top-11 z-40 w-56 rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {STYLES.map((s, i) => (
              <div key={s.label}>
                {i > 0 && s.group !== STYLES[i - 1].group && (
                  <div className="my-1 h-px bg-white/10" />
                )}
                <button
                  type="button"
                  className={`${plusItem} ${styleLabel === s.label ? "bg-white/10" : ""}`}
                  onClick={() => {
                    s.run();
                    setStyleOpen(false);
                  }}
                >
                  <span className={`w-5 text-center ${s.glyphClass}`}>{s.glyph}</span>
                  {s.label}
                </button>
              </div>
            ))}
          </div>
        )}
        {divider}
        <Tb title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </Tb>
        <Tb title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </Tb>
        <Tb title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </Tb>
        <Tb title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </Tb>
        {divider}
        <Tb
          title="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().toggleTextAlign("left").run()}
        >
          ⇤
        </Tb>
        <Tb
          title="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().toggleTextAlign("center").run()}
        >
          ↔
        </Tb>
        <Tb
          title="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().toggleTextAlign("right").run()}
        >
          ⇥
        </Tb>
        {divider}
        <Tb title="Link" active={editor.isActive("link")} onClick={setLink}>
          🔗
        </Tb>
        {divider}
        <Tb title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          ↺
        </Tb>
        <Tb title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          ↻
        </Tb>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

/* ---------- field settings popover ---------- */

function FieldSettings({
  popover,
  onUpdate,
  onDelete,
  onClose,
}: {
  popover: FieldPopover;
  onUpdate: (value: string, filledBy: "creator" | "recipient") => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(
    popover.value === popover.fieldKey ? "" : popover.value,
  );
  const [filledBy, setFilledBy] = useState(popover.filledBy);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const toggle = (mine: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      mine
        ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-sm"
        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
    }`;

  return (
    <div
      className="fixed z-50 w-80 rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left: popover.x, top: popover.y }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Field settings
        </p>
        <button
          onClick={onClose}
          className="rounded-md px-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ✕
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        Filled by
      </p>
      <div className="mt-1.5 flex gap-1 rounded-xl border border-neutral-200 p-1 dark:border-neutral-700">
        <button type="button" className={toggle(filledBy === "creator")} onClick={() => setFilledBy("creator")}>
          You (creator)
        </button>
        <button type="button" className={toggle(filledBy === "recipient")} onClick={() => setFilledBy("recipient")}>
          Recipient (signer)
        </button>
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        {filledBy === "creator"
          ? "You'll set this value now. The signer sees the final text."
          : "The signer fills this in on the signing page before signing."}
      </p>

      {filledBy === "creator" && (
        <>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Value
          </p>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onUpdate(value, filledBy);
              if (e.key === "Escape") onClose();
            }}
            placeholder={popover.fieldKey.replace(/-/g, " ")}
            className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
          <p className="mt-1 text-[11px] text-neutral-400">Enter to apply · Esc to cancel</p>
        </>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onDelete}
          title="Remove this field (keeps the text)"
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-sm text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40"
        >
          🗑
        </button>
        <button
          type="button"
          onClick={() => onUpdate(value, filledBy)}
          className="flex-1 rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
        >
          Update
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- signature assignment popover ---------- */

// The Maltivas Signature Assignment panel: a chip is either your own
// signature (pre-signed at send) or a recipient's — assigned by name +
// email. Every unique recipient email gets its own signing link at send;
// chips without an email fall to the default client email.
function SignatureAssignment({
  popover,
  onAssign,
  onRemove,
  onClose,
}: {
  popover: SignaturePopover;
  onAssign: (attrs: {
    signer: "creator" | "client";
    email: string | null;
    signerName: string | null;
  }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [who, setWho] = useState<"creator" | "client">(popover.signer);
  const [name, setName] = useState(popover.signerName);
  const [email, setEmail] = useState(popover.email);
  const emailOk = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const card = (active: boolean) =>
    `flex-1 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
      active
        ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-neutral-200 text-neutral-600 hover:border-amber-300 dark:border-neutral-700 dark:text-neutral-300"
    }`;
  const input =
    "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <div
      className="fixed z-50 w-80 rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left: popover.x, top: popover.y }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Signature assignment
        </p>
        <button
          onClick={onClose}
          className="rounded-md px-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ✕
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        Assign to
      </p>
      <div className="mt-1.5 flex gap-2">
        <button type="button" className={card(who === "creator")} onClick={() => setWho("creator")}>
          👤 Your signature
          <span className="mt-0.5 block text-xs font-normal text-neutral-500">
            Signs when you send
          </span>
        </button>
        <button type="button" className={card(who === "client")} onClick={() => setWho("client")}>
          ✉️ Recipient
          <span className="mt-0.5 block text-xs font-normal text-neutral-500">
            Signs via their link
          </span>
        </button>
      </div>

      {who === "client" && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-neutral-500">
            Recipient name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who signs here"
              className={input}
            />
          </label>
          <label className="block text-xs font-medium text-neutral-500">
            Recipient email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Their signing link goes here"
              className={input}
            />
          </label>
          {!emailOk && (
            <p className="text-xs text-red-600 dark:text-red-400">
              That doesn&apos;t look like an email.
            </p>
          )}
          <p className="text-[11px] leading-4 text-neutral-400">
            Leave the email empty to use the contract&apos;s client email.
            Each unique email gets its own signing link.
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          title="Remove this signature field"
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-sm text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40"
        >
          🗑
        </button>
        <button
          type="button"
          disabled={who === "client" && !emailOk}
          onClick={() =>
            onAssign(
              who === "creator"
                ? { signer: "creator", email: null, signerName: null }
                : {
                    signer: "client",
                    email: email.trim().toLowerCase() || null,
                    signerName: name.trim() || null,
                  },
            )
          }
          className="flex-1 rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          Assign signature
        </button>
      </div>
    </div>
  );
}

/* ---------- the editor ---------- */

export function DocEditor({
  value,
  onChange,
  channelId,
  placeholder,
  minHeight = 640,
}: {
  value: string;
  onChange: (html: string) => void;
  channelId?: string;
  placeholder?: string;
  minHeight?: number;
}) {
  const [popover, setPopover] = useState<FieldPopover | SignaturePopover | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["https", "http"] },
      }),
      Image,
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FieldMark,
      SignatureField,
      Placeholder.configure({
        placeholder: placeholder ?? "The document itself — highlighted chips are fill-ins",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose-reader block w-full px-8 py-10 text-[15px] leading-7 outline-none sm:px-12",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const popoverPosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 336)),
      y: Math.min(rect.bottom + 8, window.innerHeight - 320),
    };
  };

  // Click-to-configure: field chips open Field Settings; signature chips
  // open the signer toggle.
  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editor) return;
      const target = (e.target as HTMLElement).closest?.(
        "[data-field],[data-signature-field]",
      ) as HTMLElement | null;
      if (!target) {
        setPopover(null);
        return;
      }
      if (target.hasAttribute("data-signature-field")) {
        let found = -1;
        editor.state.doc.descendants((node, pos) => {
          if (found >= 0) return false;
          if (node.type.name === "signatureField" && editor.view.nodeDOM(pos) === target) {
            found = pos;
            return false;
          }
        });
        if (found < 0) return;
        setPopover({
          kind: "signature",
          pos: found,
          signer: (target.getAttribute("data-signer") as "creator" | "client") ?? "client",
          email: target.getAttribute("data-email") ?? "",
          signerName: target.getAttribute("data-signer-name") ?? "",
          ...popoverPosition(target),
        });
        return;
      }
      const from = editor.view.posAtDOM(target, 0);
      const text = target.textContent ?? "";
      setPopover({
        kind: "field",
        from,
        to: from + text.length,
        fieldKey: target.getAttribute("data-field") ?? "field",
        filledBy:
          (target.getAttribute("data-filled-by") as "creator" | "recipient") ?? "creator",
        value: text,
        ...popoverPosition(target),
      });
    },
    [editor],
  );

  return (
    <div className="relative">
      {editor && <FloatingToolbar editor={editor} channelId={channelId} />}
      {/* Paper canvas — a sharp document page, paper-white in both themes */}
      <div
        onClick={onCanvasClick}
        className="mx-auto mt-4 max-w-[880px] rounded-[3px] border border-neutral-300/80 bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)] dark:border-neutral-600"
      >
        <EditorContent editor={editor} />
      </div>

      {popover?.kind === "field" && editor && (
        <FieldSettings
          popover={popover}
          onClose={() => setPopover(null)}
          onUpdate={(value, filledBy) => {
            const text =
              filledBy === "creator" && value.trim()
                ? value.trim()
                : popover.value ||
                  popover.fieldKey.replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
            editor
              .chain()
              .focus()
              .setTextSelection({ from: popover.from, to: popover.to })
              .insertContent({
                type: "text",
                text,
                marks: [
                  { type: "fieldMark", attrs: { field: popover.fieldKey, filledBy } },
                ],
              })
              .run();
            setPopover(null);
          }}
          onDelete={() => {
            editor
              .chain()
              .focus()
              .setTextSelection({ from: popover.from, to: popover.to })
              .unsetMark("fieldMark")
              .run();
            setPopover(null);
          }}
        />
      )}

      {popover?.kind === "signature" && editor && (
        <SignatureAssignment
          popover={popover}
          onAssign={(attrs) => {
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(popover.pos, undefined, attrs),
            );
            setPopover(null);
          }}
          onRemove={() => {
            editor.view.dispatch(editor.state.tr.delete(popover.pos, popover.pos + 1));
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
