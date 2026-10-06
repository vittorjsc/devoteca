"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import {
  ImagePlus,
  Send,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  LoaderCircle,
  BookOpen,
  Lightbulb,
  Camera,
  UserRound,
} from "lucide-react";
import { CommunityAvatar, mediaUrl } from "@/components/community-avatar";
type User = {
  id: string;
  name: string;
  admin: boolean;
  avatar_id?: string | null;
};
type Person = {
  id: string;
  name: string;
  bio: string;
  avatar_id: string | null;
  joined: string;
};
type Entry = {
  id: string;
  kind: "post" | "resource" | "project";
  author: string;
  author_name: string;
  avatar_id: string | null;
  created: string;
  updated: string;
  body: string;
  title: string;
  url: string | null;
  status: string | null;
  image_id: string | null;
  image_alt: string;
};
type Page = { items: Entry[]; next_cursor: string | null };
const jsonBody = (value: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      data.error || "Não foi possível concluir. Tente novamente.",
    );
  return data;
}
async function upload(file: File, kind: "post" | "avatar") {
  return api<{ id: string }>("/api/community/media", {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Devoteca-Image-Kind": kind,
    },
    body: file,
  });
}
function validPhoto(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("A foto deve ter até 5 MB.");
  if (!file.size) throw new Error("A foto está vazia.");
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    !/\.(jpe?g|png|webp)$/i.test(file.name)
  )
    throw new Error("Use uma foto JPG, PNG ou WebP.");
}
function usePreview(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url;
}
function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
function PostText({ text }: { text: string }) {
  return (
    <p className="community-text">
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
function discardUpload(id: string | null) {
  if (id)
    void api("/api/community/media?id=" + encodeURIComponent(id), {
      method: "DELETE",
    }).catch(() => {});
}

export function Community({
  view,
  user,
  profileId,
  onOpenProfile,
  onOpenResource,
  onOpenProject,
  onProfileSaved,
  onProfileDirty,
  onCompose,
}: {
  view: string;
  user: User | null;
  profileId: string | null;
  onOpenProfile: (id: string) => void;
  onOpenResource: (id: string) => void;
  onOpenProject: (id: string) => void;
  onProfileSaved: () => Promise<unknown>;
  onProfileDirty: (dirty: boolean) => void;
  onCompose: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [kind, setKind] = useState("all"),
    [items, setItems] = useState<Entry[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [text, setText] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [alt, setAlt] = useState(""),
    [edit, setEdit] = useState<Entry | null>(null),
    [removePhoto, setRemovePhoto] = useState(false),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null),
    [deleting, setDeleting] = useState(false);
  const preview = usePreview(file),
    uploaded = useRef<string | null>(null),
    photoInput = useRef<HTMLInputElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    generation = useRef(0),
    readingHistory = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null);
  const dirty =
    text !== (edit?.body || "") ||
    !!file ||
    removePhoto ||
    alt !== (edit?.image_alt || "");
  useLeaveWarning(dirty);
  const load = useCallback(
    async (background = false) => {
      if (!user) return;
      // Keep older pages visible while someone is reading them. Manual refresh
      // and a changed filter explicitly return to the newest contributions.
      if (background && readingHistory.current) return;
      if (!background) readingHistory.current = false;
      const token = ++generation.current;
      try {
        const page = await api<Page>("/api/community/feed?kind=" + kind);
        if (token !== generation.current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        setError("");
      } catch (e) {
        if (token === generation.current) setError((e as Error).message);
      } finally {
        if (token === generation.current) setLoading(false);
      }
    },
    [kind, user?.id],
  );
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useEffect(() => {
    if (view !== "feed" || !user) return;
    const refresh = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, view, user?.id]);
  useEffect(() => {
    if (formError) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: "center" });
    }
  }, [formError]);
  async function loadMore() {
    if (!cursor || more) return;
    readingHistory.current = true;
    setMore(true);
    const token = generation.current;
    try {
      const page = await api<Page>(
        "/api/community/feed?kind=" +
          kind +
          "&cursor=" +
          encodeURIComponent(cursor),
      );
      if (token === generation.current) {
        setItems((old) => [
          ...old,
          ...page.items.filter(
            (row) => !old.some((p) => p.id === row.id && p.kind === row.kind),
          ),
        ]);
        setCursor(page.next_cursor);
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMore(false);
    }
  }
  function clear() {
    discardUpload(uploaded.current);
    uploaded.current = null;
    setText("");
    setAlt("");
    setEdit(null);
    setFile(null);
    setRemovePhoto(false);
    setFormError("");
    if (photoInput.current) photoInput.current.value = "";
  }
  function beginEdit(entry: Entry) {
    if (
      saving ||
      (dirty &&
        !window.confirm(
          "Descartar o rascunho atual para editar esta publicação?",
        ))
    )
      return;
    clear();
    setEdit(entry);
    setText(entry.body);
    setAlt(entry.image_alt);
    setNotice("");
    onCompose();
    setTimeout(() => {
      composer.current?.focus();
      composer.current?.scrollIntoView({ block: "center" });
    }, 0);
  }
  function changePhoto(selected?: File) {
    if (!selected) return;
    try {
      validPhoto(selected);
      discardUpload(uploaded.current);
      uploaded.current = null;
      setFile(selected);
      setRemovePhoto(false);
      setFormError("");
    } catch (e) {
      setFormError((e as Error).message);
      if (photoInput.current) photoInput.current.value = "";
    }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setFormError("");
    try {
      let image = removePhoto ? null : edit?.image_id || null;
      if (file) {
        if (!uploaded.current)
          uploaded.current = (await upload(file, "post")).id;
        image = uploaded.current;
      }
      await api(
        "/api/community/posts",
        jsonBody({ id: edit?.id, body: text, image_id: image, image_alt: alt }),
      );
      uploaded.current = null;
      clear();
      setNotice(
        edit
          ? "Publicação atualizada."
          : "Publicação compartilhada com o grupo.",
      );
      setRevision((v) => v + 1);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(
        "/api/community/posts?id=" + encodeURIComponent(pendingDelete.id),
        { method: "DELETE" },
      );
      setPendingDelete(null);
      setNotice("Publicação excluída.");
      setRevision((v) => v + 1);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }
  const existingImage =
    !removePhoto && !file && edit?.image_id ? mediaUrl(edit.image_id) : null;
  function entryCard(entry: Entry) {
    return (
      <article className="feed-entry" key={entry.kind + entry.id}>
        <div className="feed-entry-header">
          <button
            className="feed-author"
            onClick={() => onOpenProfile(entry.author)}
            aria-label={"Ver perfil de " + entry.author_name}
          >
            <CommunityAvatar
              name={entry.author_name}
              imageId={entry.avatar_id}
            />
            <span>
              <strong>{entry.author_name}</strong>
              <small>
                {entry.kind === "resource"
                  ? "Adicionou um material"
                  : entry.kind === "project"
                    ? "Compartilhou uma ideia"
                    : "Publicou"}{" "}
                · <time dateTime={entry.created}>{date(entry.created)}</time>
                {entry.kind === "post" && entry.updated !== entry.created
                  ? " · editado"
                  : ""}
              </small>
            </span>
          </button>
          {entry.kind === "post" &&
            (entry.author === user?.id || user?.admin) && (
              <div className="feed-post-actions">
                <button
                  className="icon-btn"
                  title="Editar publicação"
                  aria-label={"Editar publicação de " + entry.author_name}
                  onClick={() => beginEdit(entry)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn"
                  title="Excluir publicação"
                  aria-label={"Excluir publicação de " + entry.author_name}
                  onClick={() => setPendingDelete(entry)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
        </div>
        {entry.kind === "post" ? (
          <>
            {entry.body && <PostText text={entry.body} />}{" "}
            {entry.image_id && (
              <img
                className="feed-photo"
                src={mediaUrl(entry.image_id)}
                alt={
                  entry.image_alt ||
                  "Foto compartilhada por " + entry.author_name
                }
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="feed-reference">
            <span className="feed-reference-label">
              {entry.kind === "resource" ? (
                <BookOpen size={16} />
              ) : (
                <Lightbulb size={16} />
              )}{" "}
              {entry.kind === "resource"
                ? "Material da biblioteca"
                : "Ideia de projeto"}
            </span>
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
            <button
              className="text-btn"
              onClick={() =>
                entry.kind === "resource"
                  ? onOpenResource(entry.id)
                  : onOpenProject(entry.id)
              }
            >
              {entry.kind === "resource" ? "Ver material" : "Ver ideia"}
            </button>
          </div>
        )}
      </article>
    );
  }
  return (
    <>
      <section
        className="community-section"
        aria-label="Feed da comunidade"
        hidden={view !== "feed"}
      >
        <form className="post-composer" onSubmit={publish}>
          <div className="composer-start">
            <button
              type="button"
              className="composer-avatar"
              aria-label="Abrir meu perfil"
              onClick={() => user && onOpenProfile(user.id)}
              disabled={!user}
            >
              <CommunityAvatar
                name={user?.name || "Você"}
                imageId={user?.avatar_id}
              />
            </button>
            <div>
              <label htmlFor="community-message">
                {edit ? "Editar publicação" : "O que você quer compartilhar?"}
              </label>
              <textarea
                id="community-message"
                ref={composer}
                rows={3}
                maxLength={3000}
                placeholder="Uma descoberta, um progresso no projeto, uma pergunta para o grupo..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={saving || !user}
              />
            </div>
          </div>
          {formError && (
            <p
              className="community-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {formError}
            </p>
          )}
          {(preview || existingImage) && (
            <div className="composer-photo">
              <img
                src={preview || existingImage || ""}
                alt="Prévia da foto da publicação"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Remover foto da publicação"
                onClick={() => {
                  discardUpload(uploaded.current);
                  uploaded.current = null;
                  setFile(null);
                  setRemovePhoto(true);
                  if (photoInput.current) photoInput.current.value = "";
                }}
                disabled={saving}
              >
                <X size={18} />
              </button>
              <label htmlFor="community-photo-description">
                Descrição da foto{" "}
                <span>(opcional, ajuda na acessibilidade)</span>
              </label>
              <input
                id="community-photo-description"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                maxLength={300}
                placeholder="O que aparece na foto?"
                disabled={saving}
              />
            </div>
          )}
          <div className="composer-footer">
            <div>
              <input
                className="sr-only"
                ref={photoInput}
                id="community-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => changePhoto(e.target.files?.[0])}
                disabled={saving}
              />
              <button
                className="text-btn"
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={saving || !user}
              >
                <ImagePlus size={19} />
                {file || existingImage ? "Trocar foto" : "Adicionar foto"}
              </button>
              <small>JPG, PNG ou WebP · até 5 MB</small>
            </div>
            <div>
              {edit && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm(
                        "Descartar as alterações desta publicação?",
                      )
                    )
                      clear();
                  }}
                  disabled={saving}
                >
                  Cancelar edição
                </button>
              )}
              <span
                className="post-counter"
                aria-label="Caracteres da publicação"
              >
                {text.length}/3000
              </span>
              <button
                className="btn primary"
                disabled={
                  saving || !user || (!text.trim() && !file && !existingImage)
                }
              >
                {saving ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Send size={17} />
                )}{" "}
                {saving
                  ? "Enviando..."
                  : edit
                    ? "Salvar publicação"
                    : "Publicar"}
              </button>
            </div>
          </div>
        </form>
        {notice && (
          <p className="community-notice" role="status">
            {notice}
          </p>
        )}
        <div className="feed-toolbar">
          <div className="feed-tabs" role="group" aria-label="Filtrar o feed">
            {[
              ["all", "Tudo"],
              ["post", "Publicações"],
              ["resource", "Materiais"],
              ["project", "Projetos"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={"pill " + (kind === id ? "selected" : "")}
                aria-pressed={kind === id}
                onClick={() => {
                  if (id === kind) return;
                  setCursor(null);
                  setKind(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="icon-btn"
            aria-label="Atualizar feed"
            onClick={() => load()}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <button className="btn secondary" onClick={() => load()}>
              Tentar novamente
            </button>
          </div>
        )}
        {loading ? (
          <p className="community-loading" role="status">
            <LoaderCircle size={21} className="spin" />
            Carregando o feed...
          </p>
        ) : !items.length ? (
          <div className="feed-empty">
            <h2>
              {kind === "all"
                ? "O grupo tem espaço para conversar."
                : "Ainda não há conteúdo neste filtro."}
            </h2>
            <p>
              Compartilhe uma descoberta ou acompanhe o que seus amigos estão
              construindo.
            </p>
          </div>
        ) : (
          <div className="feed-list">{items.map(entryCard)}</div>
        )}
        {cursor && (
          <button
            className="btn secondary feed-more"
            onClick={loadMore}
            disabled={more}
          >
            {more ? "Carregando..." : "Carregar mais"}
          </button>
        )}
      </section>
      <ProfilePanel
        user={user}
        memberId={profileId || user?.id || null}
        active={view === "profile"}
        refreshRevision={revision}
        onOpenProfile={onOpenProfile}
        renderEntry={entryCard}
        onSaved={async () => {
          await onProfileSaved();
          await load();
        }}
        onDirty={onProfileDirty}
      />
      <Dialog.Root
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="modal">
            <header className="modal-header">
              <div>
                <Dialog.Title>Excluir publicação?</Dialog.Title>
                <Dialog.Description>
                  O texto e a foto serão removidos do feed para todo o grupo.
                  Esta ação não pode ser desfeita.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className="icon-btn"
                  aria-label="Fechar"
                  disabled={deleting}
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </header>
            <div className="community-dialog-actions">
              <button
                className="btn secondary"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="btn danger"
                onClick={remove}
                disabled={deleting}
              >
                {deleting ? "Excluindo..." : "Excluir publicação"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function ProfilePanel({
  user,
  memberId,
  active,
  renderEntry,
  onSaved,
  onDirty,
  refreshRevision,
}: {
  user: User | null;
  memberId: string | null;
  active: boolean;
  onOpenProfile: (id: string) => void;
  renderEntry: (entry: Entry) => React.ReactNode;
  onSaved: () => Promise<void>;
  onDirty: (dirty: boolean) => void;
  refreshRevision: number;
}) {
  const [person, setPerson] = useState<Person | null>(null),
    [items, setItems] = useState<Entry[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [bio, setBio] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [removeAvatar, setRemoveAvatar] = useState(false),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [notice, setNotice] = useState(""),
    [more, setMore] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    uploaded = useRef<string | null>(null),
    token = useRef(0),
    errorRef = useRef<HTMLParagraphElement>(null),
    preview = usePreview(file);
  const dirty =
    editing &&
    (name !== person?.name || bio !== person?.bio || !!file || removeAvatar);
  useLeaveWarning(dirty);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const load = useCallback(async () => {
    if (!memberId || !user) return;
    const generation = ++token.current;
    setLoading(true);
    try {
      const [profile, page] = await Promise.all([
        api<Person>(
          "/api/community/profile?id=" + encodeURIComponent(memberId),
        ),
        api<Page>("/api/community/feed?member=" + encodeURIComponent(memberId)),
      ]);
      if (generation !== token.current) return;
      setPerson(profile);
      setItems(page.items);
      setCursor(page.next_cursor);
      setError("");
    } catch (e) {
      if (generation === token.current) setError((e as Error).message);
    } finally {
      if (generation === token.current) setLoading(false);
    }
  }, [memberId, user?.id]);
  useEffect(() => {
    discardUpload(uploaded.current);
    uploaded.current = null;
    setMore(false);
    setPerson(null);
    setEditing(false);
    setFile(null);
    setRemoveAvatar(false);
    setNotice("");
    setFormError("");
    load();
  }, [load]);
  useEffect(() => {
    if (active && refreshRevision) load();
  }, [refreshRevision, active, load]);
  useEffect(() => {
    if (formError) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: "center" });
    }
  }, [formError]);
  function editProfile() {
    if (!person) return;
    setName(person.name);
    setBio(person.bio);
    setFile(null);
    setRemoveAvatar(false);
    setFormError("");
    setEditing(true);
    setNotice("");
  }
  function cancel() {
    if (dirty && !window.confirm("Descartar as alterações do perfil?")) return;
    discardUpload(uploaded.current);
    uploaded.current = null;
    setFile(null);
    setEditing(false);
    setFormError("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setSaving(true);
    setFormError("");
    try {
      let avatar = removeAvatar ? null : person.avatar_id;
      if (file) {
        if (!uploaded.current)
          uploaded.current = (await upload(file, "avatar")).id;
        avatar = uploaded.current;
      }
      setPerson(
        await api<Person>(
          "/api/community/profile",
          jsonBody({ name, bio, avatar_id: avatar }),
        ),
      );
      uploaded.current = null;
      setFile(null);
      setEditing(false);
      setRemoveAvatar(false);
      setNotice("Perfil atualizado para a comunidade.");
      await onSaved();
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function morePosts() {
    if (!memberId || !cursor || more) return;
    const generation = token.current;
    setMore(true);
    try {
      const page = await api<Page>(
        "/api/community/feed?member=" +
          encodeURIComponent(memberId) +
          "&cursor=" +
          encodeURIComponent(cursor),
      );
      if (generation !== token.current) return;
      setItems((old) => [
        ...old,
        ...page.items.filter(
          (row) => !old.some((p) => p.id === row.id && p.kind === row.kind),
        ),
      ]);
      setCursor(page.next_cursor);
    } catch (e) {
      if (generation === token.current) setError((e as Error).message);
    } finally {
      if (generation === token.current) setMore(false);
    }
  }
  return (
    <section
      className="community-profile-section"
      hidden={!active}
      aria-label="Perfil da comunidade"
    >
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button className="btn secondary" onClick={load}>
            Tentar novamente
          </button>
        </div>
      )}
      {notice && (
        <p className="community-notice" role="status">
          {notice}
        </p>
      )}
      {loading && !person ? (
        <p className="community-loading" role="status">
          <LoaderCircle size={21} className="spin" />
          Carregando perfil...
        </p>
      ) : (
        person && (
          <>
            {editing ? (
              <form className="community-profile-form" onSubmit={save}>
                <h2>Editar meu perfil</h2>
                <p>
                  Seu nome, foto e biografia aparecem para os convidados da
                  Devoteca.
                </p>
                {formError && (
                  <p
                    className="community-error"
                    role="alert"
                    tabIndex={-1}
                    ref={errorRef}
                  >
                    {formError}
                  </p>
                )}
                <div className="profile-photo-edit">
                  {preview ? (
                    <img
                      className="community-avatar large"
                      src={preview}
                      alt="Prévia da foto do perfil"
                    />
                  ) : (
                    <CommunityAvatar
                      size="large"
                      name={name || "Você"}
                      imageId={removeAvatar ? null : person.avatar_id}
                    />
                  )}
                  <div>
                    <input
                      ref={input}
                      className="sr-only"
                      id="community-avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={saving}
                      onChange={(e) => {
                        const photo = e.target.files?.[0];
                        if (!photo) return;
                        try {
                          validPhoto(photo);
                          discardUpload(uploaded.current);
                          uploaded.current = null;
                          setFile(photo);
                          setRemoveAvatar(false);
                          setFormError("");
                        } catch (error) {
                          setFormError((error as Error).message);
                          if (input.current) input.current.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => input.current?.click()}
                      disabled={saving}
                    >
                      <Camera size={17} />
                      Escolher foto
                    </button>
                    {(file || (person.avatar_id && !removeAvatar)) && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          discardUpload(uploaded.current);
                          uploaded.current = null;
                          setFile(null);
                          setRemoveAvatar(true);
                          if (input.current) input.current.value = "";
                        }}
                        disabled={saving}
                      >
                        Remover foto
                      </button>
                    )}
                    <small>JPG, PNG ou WebP · até 5 MB</small>
                  </div>
                </div>
                <label htmlFor="community-profile-name">
                  Nome na comunidade
                </label>
                <input
                  id="community-profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  disabled={saving}
                />
                <label htmlFor="community-profile-bio">Biografia</label>
                <textarea
                  id="community-profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Conte seus interesses, o que estuda ou o que quer construir."
                  disabled={saving}
                />
                <small>{bio.length}/500 caracteres</small>
                <div className="community-profile-form-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={cancel}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <UserRound size={17} />
                    )}{" "}
                    {saving ? "Salvando..." : "Salvar perfil"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <header className="community-profile-header">
                  <CommunityAvatar
                    size="large"
                    name={person.name}
                    imageId={person.avatar_id}
                  />
                  <div>
                    <h2>{person.name}</h2>
                    <p className="profile-biography">
                      {person.bio || "Ainda não adicionou uma biografia."}
                    </p>
                    <small>
                      Membro desde{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        month: "long",
                        year: "numeric",
                      }).format(new Date(person.joined))}
                    </small>
                  </div>
                  {person.id === user?.id && (
                    <button className="btn secondary" onClick={editProfile}>
                      <Pencil size={16} />
                      Editar perfil
                    </button>
                  )}
                </header>
                <h2 className="profile-activity-title">
                  Publicações e contribuições
                </h2>
                {items.length ? (
                  <div className="feed-list">{items.map(renderEntry)}</div>
                ) : (
                  <div className="feed-empty">
                    <p>
                      As publicações, materiais e ideias desta pessoa aparecerão
                      aqui.
                    </p>
                  </div>
                )}
                {cursor && (
                  <button
                    className="btn secondary feed-more"
                    onClick={morePosts}
                    disabled={more}
                  >
                    {more ? "Carregando..." : "Carregar mais"}
                  </button>
                )}
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
