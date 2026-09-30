"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog as D } from "radix-ui";
import { TranslationPanel } from "@/components/translation-panel";
import { Languages } from "lucide-react";
import {
  BookOpen,
  Library as LibraryIcon,
  Star,
  Plus,
  Search,
  Folder,
  Users,
  GitBranch,
  FileText,
  Globe,
  Video,
  GraduationCap,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Upload,
  Download,
  X,
  ExternalLink,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  Lock,
  Copy,
  RefreshCw,
  Bookmark,
  ChevronDown,
  Link as LinkIcon,
  LoaderCircle,
  LogOut,
  Hash,
  Command,
} from "lucide-react";
type Resource = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  type: string;
  category: string | null;
  tags: string;
  author: string;
  author_name: string;
  created: string;
  updated: string;
  file_key: string | null;
  file_name: string | null;
  file_size: number | null;
  favorite: number;
  reading: string;
  comment_count: number;
};
type Category = { id: string; name: string; color: string };
type Member = { id: string; name: string; joined: string };
type Comment = {
  id: string;
  body: string;
  name: string;
  member: string;
  created: string;
};
type State = {
  resources: Resource[];
  categories: Category[];
  members: Member[];
  user: { id: string; name: string; admin: boolean };
};
type Draft = {
  id?: string;
  title: string;
  description: string;
  url: string;
  type: string;
  category: string;
  tags: string;
};
const empty: Draft = {
  title: "",
  description: "",
  url: "",
  type: "github",
  category: "",
  tags: "",
};
const kinds: Record<
  string,
  { label: string; icon: typeof Globe; color: string }
> = {
  github: { label: "GitHub", icon: GitBranch, color: "purple" },
  article: { label: "Artigo", icon: FileText, color: "blue" },
  document: { label: "Documento", icon: FileText, color: "orange" },
  course: { label: "Curso", icon: GraduationCap, color: "green" },
  site: { label: "Site / ferramenta", icon: Globe, color: "cyan" },
  video: { label: "Vídeo", icon: Video, color: "pink" },
};
const colors = ["blue", "green", "orange", "purple", "pink", "cyan"];
const initials = (s: string) =>
  s
    .split(/[ @._]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
const date = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(s),
  );
const tagsOf = (r: Resource): string[] => {
  try {
    return JSON.parse(r.tags);
  } catch {
    return [];
  }
};
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(path, options);
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw new Error(
      data.error || "Não foi possível concluir. Tente novamente.",
    );
  return data;
}
const body = (data: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <D.Portal>
        <D.Overlay className="overlay" />
        <D.Content
          className={"modal " + (wide ? "wide" : "")}
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <header className="modal-header">
            <div>
              <D.Title>{title}</D.Title>
              {description && (
                <D.Description id="dialog-description">
                  {description}
                </D.Description>
              )}
            </div>
            <D.Close asChild>
              <button className="icon-btn" aria-label="Fechar">
                <X size={20} />
              </button>
            </D.Close>
          </header>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
export default function Library() {
  const [data, setData] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [view, setView] = useState("all"),
    [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [type, setType] = useState(""),
    [sort, setSort] = useState("recent"),
    [layout, setLayout] = useState("grid"),
    [tag, setTag] = useState(""),
    [author, setAuthor] = useState("");
  const [showForm, setShowForm] = useState(false),
    [draft, setDraft] = useState<Draft>(empty),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [githubBusy, setGithubBusy] = useState(false);
  const [showCategories, setShowCategories] = useState(false),
    [categoryName, setCategoryName] = useState(""),
    [categoryColor, setCategoryColor] = useState("blue");
  const [translation, setTranslation] = useState<Resource | null>(null);
  const [selected, setSelected] = useState<Resource | null>(null),
    [comments, setComments] = useState<Comment[]>([]),
    [comment, setComment] = useState(""),
    [commentsLoading, setCommentsLoading] = useState(false),
    [detailError, setDetailError] = useState("");
  const [showShare, setShowShare] = useState(false),
    [showImport, setShowImport] = useState(false),
    [importText, setImportText] = useState(""),
    [importReport, setImportReport] = useState(""),
    [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const reload = useCallback(async () => {
    try {
      const s = await api("/api/library");
      setData(s);
      setError("");
      return s as State;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [reload]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search")?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const resources = data?.resources ?? [],
    categories = data?.categories ?? [],
    members = data?.members ?? [];
  const allTags = useMemo(
    () => [...new Set(resources.flatMap(tagsOf))].sort(),
    [resources],
  );
  const filtered = useMemo(
    () =>
      resources
        .filter(
          (r) =>
            (!category || r.category === category) &&
            (!type || r.type === type) &&
            (!author || r.author === author) &&
            (!tag || tagsOf(r).includes(tag)) &&
            (view !== "favorites" || r.favorite) &&
            (view !== "mine" || r.author === data?.user.id) &&
            (view !== "reading" || r.reading === "reading") &&
            (!query ||
              normalize(
                [
                  r.title,
                  r.description,
                  r.url,
                  r.author_name,
                  ...tagsOf(r),
                ].join(" "),
              ).includes(normalize(query))),
        )
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title, "pt-BR")
            : sort === "oldest"
              ? a.created.localeCompare(b.created)
              : sort === "popular"
                ? b.comment_count - a.comment_count
                : b.created.localeCompare(a.created),
        ),
    [resources, category, type, author, tag, view, query, sort, data?.user.id],
  );
  const activeCategory = categories.find((c) => c.id === category);
  const navigate = (v: string, c = "") => {
    setView(v);
    setCategory(c);
    setTag("");
    setQuery("");
  };
  const add = () => {
    setDraft({ ...empty, category });
    setFile(null);
    setFormError("");
    setShowForm(true);
  };
  const edit = (r: Resource) => {
    setSelected(null);
    setDraft({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url ?? "",
      type: r.type,
      category: r.category ?? "",
      tags: tagsOf(r).join(", "),
    });
    setFile(null);
    setFormError("");
    setShowForm(true);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const f = new FormData();
      Object.entries(draft).forEach(([k, v]) => f.set(k, v));
      if (file) f.set("file", file);
      if (file) {
        await api("/api/files", {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Devoteca-Metadata": encodeURIComponent(
              JSON.stringify({
                ...draft,
                fileName: file.name,
                fileType: file.type,
              }),
            ),
          },
          body: file,
        });
      } else {
        await api("/api/library", { method: "POST", body: f });
      }
      setShowForm(false);
      setToast(
        draft.id ? "Material atualizado." : "Material adicionado à biblioteca.",
      );
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function patch(r: Resource, action: string, value: unknown) {
    try {
      await api("/api/library", {
        ...body({ id: r.id, action, value }),
        method: "PATCH",
      });
      setData((d) =>
        d
          ? {
              ...d,
              resources: d.resources.map((x) =>
                x.id === r.id
                  ? {
                      ...x,
                      [action === "favorite" ? "favorite" : "reading"]: value,
                    }
                  : x,
              ),
            }
          : d,
      );
      setSelected((s) =>
        s?.id === r.id
          ? { ...s, [action === "favorite" ? "favorite" : "reading"]: value }
          : s,
      );
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function openDetail(r: Resource) {
    setSelected(r);
    setComments([]);
    setComment("");
    setDetailError("");
    setCommentsLoading(true);
    try {
      setComments(await api("/api/comments?id=" + encodeURIComponent(r.id)));
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setCommentsLoading(false);
    }
  }
  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setDetailError("");
    try {
      await api("/api/comments", body({ id: selected.id, body: comment }));
      setComment("");
      setComments(
        await api("/api/comments?id=" + encodeURIComponent(selected.id)),
      );
      await reload();
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api(
        "/api/categories",
        body({ name: categoryName, color: categoryColor }),
      );
      setCategoryName("");
      await reload();
      setToast("Categoria criada.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function github() {
    setGithubBusy(true);
    setFormError("");
    try {
      const g = await api("/api/github", body({ url: draft.url }));
      setDraft((d) => ({ ...d, ...g }));
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setGithubBusy(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await api("/api/library?id=" + encodeURIComponent(pendingDelete.id), {
        method: "DELETE",
      });
      setPendingDelete(null);
      setSelected(null);
      await reload();
      setToast("Material excluído.");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importLinks(e: React.FormEvent) {
    e.preventDefault();
    const links = importText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (links.length > 50) {
      setImportReport("Importe até 50 links por vez.");
      return;
    }
    setBusy(true);
    let saved = 0;
    const failures: string[] = [];
    for (const link of links) {
      try {
        const url = new URL(link);
        if (!["https:", "http:"].includes(url.protocol))
          throw new Error("Link inválido");
        const f = new FormData();
        f.set("url", url.href);
        f.set(
          "title",
          url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, ""),
        );
        f.set("type", url.hostname === "github.com" ? "github" : "site");
        f.set("description", "");
        f.set("tags", "");
        f.set("category", category);
        await api("/api/library", { method: "POST", body: f });
        saved++;
      } catch (e) {
        failures.push(link + " — " + (e as Error).message);
      }
    }
    await reload();
    setBusy(false);
    setImportText(failures.map((s) => s.split(" — ")[0]).join("\n"));
    setImportReport(
      `${saved} link(s) adicionado(s). ${failures.length ? failures.join("\n") : "Todos os links foram salvos."}`,
    );
  }
  function exportData() {
    if (!data) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { exported: new Date().toISOString(), categories, resources },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = "devoteca-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(u);
    setToast("Catálogo exportado. Baixe os anexos pelos materiais.");
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            d<span>/</span>
          </span>
          <span>
            devoteca<span className="brand-dot">.</span>
            <small>BIBLIOTECA DO GRUPO</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">
            <Command size={18} />
          </span>
          <div>
            <strong>Nosso espaço</strong>
            <small>Ciência da computação</small>
          </div>
          <Lock size={14} />
        </div>
        <p className="nav-label">BIBLIOTECA</p>
        <nav aria-label="Biblioteca">
          {[
            {
              id: "all",
              label: "Todos os materiais",
              icon: LibraryIcon,
              count: resources.length,
            },
            {
              id: "favorites",
              label: "Meus favoritos",
              icon: Star,
              count: resources.filter((r) => r.favorite).length,
            },
            {
              id: "reading",
              label: "Estou estudando",
              icon: BookOpen,
              count: resources.filter((r) => r.reading === "reading").length,
            },
            {
              id: "mine",
              label: "Minhas contribuições",
              icon: Upload,
              count: resources.filter((r) => r.author === data?.user.id).length,
            },
          ].map((n) => (
            <button
              key={n.id}
              className={
                "nav-item " + (view === n.id && !category ? "active" : "")
              }
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              <small>{n.count}</small>
            </button>
          ))}
          <button
            className="nav-item mobile-members"
            onClick={() => navigate("members")}
          >
            <Users size={18} />
            <span>Pessoas</span>
          </button>
        </nav>
        <div className="nav-section">
          <p className="nav-label">CATEGORIAS</p>
          <button
            aria-label="Gerenciar categorias"
            className="sidebar-icon"
            onClick={() => {
              setFormError("");
              setShowCategories(true);
            }}
          >
            <Plus size={17} />
          </button>
        </div>
        <nav aria-label="Categorias">
          {categories.map((c) => (
            <button
              key={c.id}
              className={
                "nav-item category-nav " + (category === c.id ? "active" : "")
              }
              onClick={() => navigate("all", c.id)}
            >
              <span className={"category-dot " + c.color} />
              <span>{c.name}</span>
              <small>
                {resources.filter((r) => r.category === c.id).length}
              </small>
            </button>
          ))}
          {!categories.length && (
            <button
              className="empty-categories"
              onClick={() => {
                setFormError("");
                setShowCategories(true);
              }}
            >
              <Plus size={14} />
              Criar a primeira categoria
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={"nav-item " + (view === "members" ? "active" : "")}
            onClick={() => navigate("members")}
          >
            <Users size={18} />
            <span>Pessoas do grupo</span>
            <small>{members.length}</small>
          </button>
          <div className="private-note">
            <Lock size={15} />
            <span>Acesso só por convite</span>
          </div>
          <div className="profile">
            <span className="avatar">
              {initials(data?.user.name || "Você")}
            </span>
            <div>
              <strong>{data?.user.name?.split("@")[0] || "Sua conta"}</strong>
              <small>
                {data?.user.admin ? "Administrador" : "Colaborador"}
              </small>
            </div>
            <a
              href="/signout-with-chatgpt?return_to=/"
              target="_top"
              aria-label="Sair da conta"
            >
              <LogOut size={17} />
            </a>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Nosso espaço</span>
            <span>/</span>
            <strong>{view === "members" ? "Pessoas" : "Biblioteca"}</strong>
          </div>
          <div className="top-actions">
            <span className="private-badge">
              <Lock size={13} />
              Privado
            </span>
            <button
              className="btn secondary"
              onClick={() => setShowShare(true)}
            >
              <Users size={16} />
              Compartilhar
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CONHECIMENTO COMPARTILHADO</p>
              <h1>
                {view === "members"
                  ? "Pessoas do grupo"
                  : activeCategory?.name ||
                    (
                      {
                        all: "Uma boa referência fica.",
                        favorites: "Seus favoritos",
                        reading: "Estou estudando",
                        mine: "Minhas contribuições",
                      } as Record<string, string>
                    )[view]}
              </h1>
              <p>
                {view === "members"
                  ? "Quem já entrou neste espaço e está construindo a biblioteca com você."
                  : view === "all" && !category
                    ? "Tudo o que vale guardar, em um só lugar."
                    : view === "favorites"
                      ? "As referências que você quer ter sempre por perto."
                      : view === "reading"
                        ? "Continue de onde parou."
                        : view === "mine"
                          ? "Os materiais que você compartilhou com o grupo."
                          : "Explore os materiais desta categoria."}
              </p>
            </div>
            <button className="btn primary" onClick={add} disabled={!data}>
              <Plus size={18} />
              Adicionar material
            </button>
          </div>
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button className="btn secondary" onClick={() => reload()}>
                Tentar novamente
              </button>
            </div>
          )}
          {view === "members" ? (
            <>
              <div className="section-title">
                <h2>
                  {members.length} {members.length === 1 ? "pessoa" : "pessoas"}{" "}
                  neste espaço
                </h2>
                <button
                  className="btn secondary"
                  onClick={() => setShowShare(true)}
                >
                  <Users size={16} />
                  Convidar amigos
                </button>
              </div>
              <div className="member-grid">
                {members.map((m) => (
                  <article className="member-card" key={m.id}>
                    <span className="avatar large">{initials(m.name)}</span>
                    <h3>{m.name}</h3>
                    <p>{m.id === data?.user.id ? "Você" : "Colaborador"}</p>
                    <small>Entrou em {date(m.joined)}</small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="overview">
                <div>
                  <span className="stat-icon">
                    <LibraryIcon size={19} />
                  </span>
                  <span>
                    <strong>{resources.length}</strong>
                    <small>materiais no acervo</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon purple">
                    <GitBranch size={19} />
                  </span>
                  <span>
                    <strong>
                      {resources.filter((r) => r.type === "github").length}
                    </strong>
                    <small>repositórios GitHub</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon orange">
                    <Folder size={19} />
                  </span>
                  <span>
                    <strong>{categories.length}</strong>
                    <small>categorias</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon green">
                    <Users size={19} />
                  </span>
                  <span>
                    <strong>{members.length}</strong>
                    <small>
                      {members.length === 1
                        ? "pessoa contribuindo"
                        : "pessoas contribuindo"}
                    </small>
                  </span>
                </div>
              </div>
              <section className="library-section" aria-label="Materiais">
                <div className="section-title">
                  <h2>
                    {activeCategory?.name || "Acervo do grupo"}
                    <span>{filtered.length}</span>
                  </h2>
                  <div className="section-actions">
                    <button
                      className="icon-btn"
                      aria-label="Gerenciar categorias"
                      title="Gerenciar categorias"
                      onClick={() => {
                        setFormError("");
                        setShowCategories(true);
                      }}
                    >
                      <Folder size={17} />
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setImportReport("");
                        setShowImport(true);
                      }}
                      disabled={!data}
                    >
                      <Upload size={15} />
                      Importar links
                    </button>
                    <button
                      className="icon-btn"
                      title="Exportar catálogo em JSON"
                      aria-label="Exportar catálogo em JSON"
                      onClick={exportData}
                      disabled={!data}
                    >
                      <Download size={17} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Atualizar biblioteca"
                      onClick={() => reload()}
                    >
                      <RefreshCw size={17} />
                    </button>
                  </div>
                </div>
                <div className="search-row">
                  <label className="searchbox" htmlFor="search">
                    <Search size={19} />
                    <input
                      id="search"
                      placeholder="Buscar por título, tag, autor ou link..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <kbd>Ctrl K</kbd>
                  </label>
                  <label className="filter-select">
                    <SlidersHorizontal size={16} />
                    <select
                      aria-label="Filtrar por tipo"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="">Todos os tipos</option>
                      {Object.entries(kinds).map(([id, k]) => (
                        <option key={id} value={id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="filter-row">
                  <div className="filter-pills">
                    <button
                      className={"pill " + (!tag ? "selected" : "")}
                      onClick={() => setTag("")}
                    >
                      Todas as tags
                    </button>
                    {allTags.slice(0, 7).map((t) => (
                      <button
                        key={t}
                        className={"pill " + (tag === t ? "selected" : "")}
                        onClick={() => setTag(tag === t ? "" : t)}
                      >
                        #{t}
                      </button>
                    ))}
                    {allTags.length > 7 && (
                      <select
                        aria-label="Mais tags"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                      >
                        <option value="">Mais tags</option>
                        {allTags.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="sort-controls">
                    <select
                      aria-label="Filtrar por categoria"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setView("all");
                      }}
                    >
                      <option value="">Todas as categorias</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filtrar por colaborador"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                    >
                      <option value="">Todos os autores</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name.split(" ")[0]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Ordenar materiais"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">Mais recentes</option>
                      <option value="oldest">Mais antigos</option>
                      <option value="title">A–Z</option>
                      <option value="popular">Mais comentados</option>
                    </select>
                    <div className="view-toggle">
                      <button
                        className={layout === "grid" ? "selected" : ""}
                        aria-label="Visualização em cartões"
                        aria-pressed={layout === "grid"}
                        onClick={() => setLayout("grid")}
                      >
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        className={layout === "list" ? "selected" : ""}
                        aria-label="Visualização em lista"
                        aria-pressed={layout === "list"}
                        onClick={() => setLayout("list")}
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>
                </div>
                {loading ? (
                  <div className="empty-state">
                    <LoaderCircle className="spin" size={28} />
                    <h3>Carregando a biblioteca...</h3>
                  </div>
                ) : filtered.length ? (
                  <div
                    className={
                      "resource-grid " +
                      (layout === "list" ? "list-layout" : "")
                    }
                  >
                    {filtered.map((r) => {
                      const k = kinds[r.type] || kinds.site,
                        c = categories.find((x) => x.id === r.category);
                      return (
                        <article className="resource-card" key={r.id}>
                          <div className="card-top">
                            <span className={"resource-icon " + k.color}>
                              <k.icon size={22} />
                            </span>
                            <span className="type-label">{k.label}</span>
                            <button
                              className={
                                "icon-btn favorite " +
                                (r.favorite ? "is-favorite" : "")
                              }
                              aria-label={
                                r.favorite
                                  ? "Remover dos favoritos"
                                  : "Adicionar aos favoritos"
                              }
                              onClick={() => patch(r, "favorite", !r.favorite)}
                            >
                              <Star
                                size={18}
                                fill={r.favorite ? "currentColor" : "none"}
                              />
                            </button>
                          </div>
                          <button
                            className="card-content"
                            onClick={() => openDetail(r)}
                          >
                            <h3>{r.title}</h3>
                            <p>
                              {r.description ||
                                "Abra o material para ver os detalhes e conversar com o grupo."}
                            </p>
                          </button>
                          <div className="card-tags">
                            {c && (
                              <button
                                className={"category-chip " + c.color}
                                onClick={() => navigate("all", c.id)}
                              >
                                {c.name}
                              </button>
                            )}
                            {tagsOf(r)
                              .slice(0, 2)
                              .map((t) => (
                                <button
                                  key={t}
                                  className="tag"
                                  onClick={() => setTag(t)}
                                >
                                  #{t}
                                </button>
                              ))}
                          </div>
                          <div className="card-translation">
                            <button
                              className="text-btn"
                              aria-label={"Traduzir " + r.title}
                              onClick={() => setTranslation(r)}
                            >
                              <Languages size={15} />
                              Traduzir
                            </button>
                          </div>
                          <footer className="card-footer">
                            <span className="author">
                              <span className="tiny-avatar">
                                {initials(r.author_name)}
                              </span>
                              {r.author_name
                                .split("@")[0]
                                .split(" ")
                                .slice(0, 2)
                                .join(" ")}
                            </span>
                            <span className="card-meta">
                              {r.reading === "done" && (
                                <span title="Estudado">
                                  <Check size={14} />
                                </span>
                              )}
                              {r.reading === "reading" && (
                                <span title="Estou estudando">
                                  <BookOpen size={14} />
                                </span>
                              )}
                              {r.comment_count > 0 && (
                                <span>
                                  <MessageSquare size={13} />
                                  {r.comment_count}
                                </span>
                              )}
                              <time dateTime={r.created}>
                                {date(r.created)}
                              </time>
                            </span>
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Bookmark size={32} />
                    </span>
                    <h3>
                      {resources.length
                        ? "Nenhum material por aqui."
                        : "O acervo começa com uma boa descoberta."}
                    </h3>
                    <p>
                      {resources.length
                        ? "Experimente outra busca ou ajuste os filtros."
                        : "Salve aquele repositório, artigo ou documento que merece sair do grupo e ficar à mão."}
                    </p>
                    {resources.length ? (
                      <button
                        className="btn secondary"
                        onClick={() => {
                          navigate("all");
                          setType("");
                          setAuthor("");
                        }}
                      >
                        Limpar filtros
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        onClick={add}
                        disabled={!data}
                      >
                        <Plus size={17} />
                        Guardar o primeiro material
                      </button>
                    )}
                    <div className="empty-formats">
                      <span>
                        <GitBranch size={15} />
                        Repositórios
                      </span>
                      <span>
                        <FileText size={15} />
                        Documentos
                      </span>
                      <span>
                        <LinkIcon size={15} />
                        Links
                      </span>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>Feito para descobrir juntos.</span>
            <span>
              <Lock size={12} />O acervo fica salvo online.
            </span>
          </footer>
        </main>
      </div>
      <Modal
        open={showForm}
        onClose={() => !busy && setShowForm(false)}
        title={draft.id ? "Editar material" : "Guardar um material"}
        description="Compartilhe algo que pode ajudar o grupo."
        wide
      >
        <form onSubmit={save} className="form">
          <label>
            Link
            <div className="link-input">
              <LinkIcon size={18} />
              <input
                type="url"
                maxLength={2048}
                placeholder="https://github.com/autor/repositorio"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </div>
          </label>
          {draft.url.includes("github.com") && (
            <button
              className="btn secondary github-fetch"
              type="button"
              onClick={github}
              disabled={githubBusy}
            >
              {githubBusy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <GitBranch size={16} />
              )}
              Preencher com dados do GitHub
            </button>
          )}
          <label>
            Título *
            <input
              required
              maxLength={180}
              placeholder="Como vocês vão encontrar este material?"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Descrição
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="Por que vale guardar? Como ele pode ajudar?"
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <div className="form-columns">
            <label>
              Tipo
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                {Object.entries(kinds).map(([id, k]) => (
                  <option key={id} value={id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Tags
            <input
              maxLength={400}
              placeholder="react, algoritmos, entrevistas"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
            <small>Separe por vírgula. Até 10 tags.</small>
          </label>
          {!draft.id && (
            <label className="upload-field">
              <Upload size={20} />
              <span>
                <strong>{file?.name || "Anexar um arquivo"}</strong>
                <small>
                  PDF, documentos, planilhas, imagens ou ZIP · até 20 MB
                </small>
              </span>
              <input
                type="file"
                aria-label="Anexar arquivo"
                accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.zip,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 20 * 1024 * 1024) {
                    setFormError("O limite por arquivo é 20 MB.");
                    e.target.value = "";
                    return;
                  }
                  setFile(f);
                  setFormError("");
                }}
              />
            </label>
          )}
          {formError && (
            <p className="inline-error" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-footer">
            <span>
              <Lock size={13} />
              Visível apenas para o grupo
            </span>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || githubBusy}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={17} />
              )}
              Salvar material
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={showCategories}
        onClose={() => !busy && setShowCategories(false)}
        title="Organizar categorias"
        description="Crie temas que façam sentido para o grupo."
      >
        <div className="category-manager">
          {categories.map((c) => (
            <div key={c.id}>
              <span className={"category-dot " + c.color} />
              <strong>{c.name}</strong>
              <small>
                {resources.filter((r) => r.category === c.id).length} materiais
              </small>
              {data?.user.admin && (
                <button
                  className="icon-btn"
                  aria-label={"Excluir categoria " + c.name}
                  onClick={async () => {
                    try {
                      await api(
                        "/api/categories?id=" + encodeURIComponent(c.id),
                        { method: "DELETE" },
                      );
                      await reload();
                    } catch (e) {
                      setFormError((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={addCategory} className="form">
          <label>
            Nova categoria
            <input
              required
              maxLength={50}
              placeholder="Ex.: Inteligência artificial"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </label>
          <div
            className="color-picker"
            role="group"
            aria-label="Cor da categoria"
          >
            {colors.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={"Cor " + c}
                aria-pressed={c === categoryColor}
                className={
                  "color-option " + c + (c === categoryColor ? " checked" : "")
                }
                onClick={() => setCategoryColor(c)}
              >
                {c === categoryColor && <Check size={14} />}
              </button>
            ))}
          </div>
          {formError && (
            <p className="inline-error" role="alert">
              {formError}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            <Plus size={17} />
            Criar categoria
          </button>
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detalhes do material"
        wide
      >
        {selected && (
          <div className="detail">
            <div className="detail-type">
              <span
                className={
                  "category-chip " + (kinds[selected.type]?.color || "blue")
                }
              >
                {kinds[selected.type]?.label}
              </span>
              <button
                className={
                  "text-btn " + (selected.favorite ? "is-favorite" : "")
                }
                onClick={() => patch(selected, "favorite", !selected.favorite)}
              >
                <Star
                  size={17}
                  fill={selected.favorite ? "currentColor" : "none"}
                />
                {selected.favorite ? "Favoritado" : "Favoritar"}
              </button>
            </div>
            <h2>{selected.title}</h2>
            <p className="detail-description">
              {selected.description || "Sem descrição."}
            </p>
            <div className="card-tags">
              {tagsOf(selected).map((t) => (
                <span className="tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
            <p className="detail-author">
              Adicionado por {selected.author_name} · {date(selected.created)}
            </p>
            <div className="detail-links">
              <button
                className="btn secondary"
                onClick={() => setTranslation(selected)}
              >
                <Languages size={16} />
                Traduzir
              </button>
              {selected.url && (
                <a
                  className="btn primary"
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} />
                  Abrir material
                </a>
              )}
              {selected.file_key && (
                <a
                  className="btn secondary"
                  href={"/api/files?id=" + encodeURIComponent(selected.id)}
                >
                  <Download size={16} />
                  Baixar arquivo
                </a>
              )}
            </div>
            {selected.file_name && (
              <p className="file-meta">
                {selected.file_name} ·{" "}
                {((selected.file_size || 0) / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
            <div className="detail-tools">
              <label>
                Meu progresso
                <select
                  value={selected.reading}
                  onChange={(e) => patch(selected, "reading", e.target.value)}
                >
                  <option value="unread">Quero estudar</option>
                  <option value="reading">Estou estudando</option>
                  <option value="done">Já estudei</option>
                </select>
              </label>
              {(selected.author === data?.user.id || data?.user.admin) && (
                <div>
                  <button className="text-btn" onClick={() => edit(selected)}>
                    <Pencil size={15} />
                    Editar
                  </button>
                  <button
                    className="text-btn danger"
                    onClick={() => setPendingDelete(selected)}
                  >
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </div>
              )}
            </div>
            <section className="comments">
              <h3>
                <MessageSquare size={18} />
                Conversa sobre o material <span>{comments.length}</span>
              </h3>
              {commentsLoading ? (
                <p>Carregando comentários...</p>
              ) : comments.length ? (
                comments.map((c) => (
                  <article className="comment" key={c.id}>
                    <span className="tiny-avatar">{initials(c.name)}</span>
                    <div>
                      <header>
                        <strong>{c.name}</strong>
                        <small>{date(c.created)}</small>
                        {(c.member === data?.user.id || data?.user.admin) && (
                          <button
                            className="icon-btn"
                            aria-label="Excluir comentário"
                            onClick={async () => {
                              try {
                                await api(
                                  "/api/comments?id=" +
                                    encodeURIComponent(c.id),
                                  { method: "DELETE" },
                                );
                                setComments(
                                  await api(
                                    "/api/comments?id=" +
                                      encodeURIComponent(selected.id),
                                  ),
                                );
                                await reload();
                              } catch (e) {
                                setDetailError((e as Error).message);
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </header>
                      <p>{c.body}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">
                  Compartilhe uma dica, dúvida ou experiência com este material.
                </p>
              )}
              <form onSubmit={sendComment}>
                <label className="sr-only" htmlFor="comment">
                  Seu comentário
                </label>
                <textarea
                  id="comment"
                  required
                  rows={2}
                  maxLength={1500}
                  placeholder="O que você achou?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button
                  className="btn secondary"
                  disabled={busy || !comment.trim()}
                >
                  Comentar
                </button>
              </form>
              {detailError && (
                <p role="alert" className="inline-error">
                  {detailError}
                </p>
              )}
            </section>
          </div>
        )}
      </Modal>
      <Modal
        open={showShare}
        onClose={() => setShowShare(false)}
        title="Compartilhar com o grupo"
        description="Este espaço é privado. Copiar o link não libera o acesso."
      >
        <div className="share-panel">
          <span className="share-lock">
            <Lock size={26} />
          </span>
          <h3>Somente pessoas convidadas</h3>
          <p>
            Para adicionar ou remover pessoas, peça no chat do Codex e informe
            os e-mails. O convite é enviado por e-mail; cada amigo entra com sua
            conta ChatGPT para salvar e comentar.
          </p>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.origin);
                setToast(
                  "Link copiado. Compartilhe com pessoas que já foram convidadas.",
                );
              } catch {
                setToast(
                  "Não foi possível copiar. Copie o endereço do navegador.",
                );
              }
            }}
          >
            <Copy size={16} />
            Copiar link da biblioteca
          </button>
          <small>
            Todos os convidados podem adicionar materiais e categorias. Cada
            autor pode editar e excluir suas contribuições; o administrador pode
            gerenciar o acervo.
          </small>
        </div>
      </Modal>
      <Modal
        open={showImport}
        onClose={() => !busy && setShowImport(false)}
        title="Trazer links do grupo"
        description="Cole um link por linha. Até 50 links por vez."
      >
        <form className="form" onSubmit={importLinks}>
          <label>
            Links
            <textarea
              required
              rows={8}
              placeholder={
                "https://github.com/autor/repositorio\nhttps://site.com/artigo"
              }
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </label>
          <p className="muted">
            Os links recebem um título inicial pelo endereço. Você pode editar
            as informações depois.
            {activeCategory && ` Serão guardados em ${activeCategory.name}.`}
          </p>
          {importReport && (
            <p className="import-report" role="status">
              {importReport}
            </p>
          )}
          <button className="btn primary" disabled={busy || !importText.trim()}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Upload size={17} />
            )}
            Importar links
          </button>
        </form>
      </Modal>
      <Modal
        open={!!pendingDelete}
        onClose={() => !busy && setPendingDelete(null)}
        title="Excluir este material?"
      >
        <div className="form">
          <p>
            “{pendingDelete?.title}” será removido da biblioteca, junto com os
            comentários e o arquivo anexado. Esta ação não pode ser desfeita.
          </p>
          <div className="confirm-actions">
            <button
              className="btn secondary"
              onClick={() => setPendingDelete(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="btn delete-btn" onClick={remove} disabled={busy}>
              Excluir material
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={!!translation}
        onClose={() => setTranslation(null)}
        title="Traduzir material"
        description="Escolha a página completa ou um trecho para ler em português."
        wide
      >
        {translation && (
          <TranslationPanel key={translation.id} material={translation} />
        )}
      </Modal>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-btn"
            aria-label="Fechar aviso"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
