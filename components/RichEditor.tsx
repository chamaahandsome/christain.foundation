"use client";

// TipTap rich-text editor (the Maltivas RichEditor pattern, rebuilt on CF's
// design system — no shadcn/lucide). Emits HTML; anything stored is passed
// through lib/sanitize-html server-side before it renders to readers.

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";

function ToolbarButton({
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
      className={`rounded-md px-2 py-1 text-sm leading-none transition-colors disabled:opacity-40 ${
        active
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, channelId }: { editor: Editor; channelId?: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addImage = useCallback(() => {
    if (channelId) {
      fileInput.current?.click();
      return;
    }
    const url = window.prompt("Image URL (https://…)", "https://");
    if (url && /^https:\/\//i.test(url)) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor, channelId]);

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

  const addYoutube = useCallback(() => {
    const url = window.prompt("YouTube video URL", "https://www.youtube.com/watch?v=");
    if (!url) return;
    // The extension parses watch/short/embed URLs itself; invalid input no-ops.
    editor.commands.setYoutubeVideo({ src: url });
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

  const divider = <span className="mx-0.5 h-5 w-px self-center bg-neutral-200 dark:bg-neutral-700" />;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      {divider}
      <ToolbarButton
        title="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <span className="font-semibold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        title="Subheading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <span className="font-semibold">H3</span>
      </ToolbarButton>
      {divider}
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        ••
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        &ldquo;&rdquo;
      </ToolbarButton>
      {divider}
      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton
        title="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </ToolbarButton>
      {divider}
      <ToolbarButton title={channelId ? "Upload image" : "Insert image by URL"} disabled={uploading} onClick={addImage}>
        {uploading ? "…" : "🖼"}
      </ToolbarButton>
      <ToolbarButton title="Embed a YouTube video" onClick={addYoutube}>
        ▶
      </ToolbarButton>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
      />
      {divider}
      <ToolbarButton
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↺
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↻
      </ToolbarButton>
    </div>
  );
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 160,
  channelId,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** When set, the image button uploads to S3 via the studio endpoint;
   * without it, images are inserted by URL. */
  channelId?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // v3 StarterKit bundles underline + link — configure, don't re-add.
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["https", "http"] },
      }),
      Image,
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-reader block w-full px-3 py-2 text-sm outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  // External writes (e.g. a file import filling the field) reach the editor;
  // the editor's own onUpdate echoes are ignored by the getHTML comparison.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div className="w-full rounded-lg border border-neutral-300 focus-within:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-amber-600">
      {editor && <Toolbar editor={editor} channelId={channelId} />}
      <EditorContent editor={editor} />
    </div>
  );
}
