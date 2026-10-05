"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useId,
  useRef,
} from "react";
import { Dialog } from "radix-ui";
import {
  Lightbulb,
  Plus,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  ArrowLeft,
  LoaderCircle,
  BookOpen,
  ChevronDown,
  Download,
} from "lucide-react";

type Resource = { id: string; title: string; url: string | null };
type User = { id: string; name: string; admin: boolean };
type Project = {
  id: string;
  title: string;
  description: string;
  inspiration: string;
  links: string;
  tags: string;
  next_steps: string;
  status: string;
  source_resource: string | null;
  source_title: string | null;
  source_url: string | null;
  author: string;
  author_name: string;
  created: string;
  updated: string;
};
type Draft = {
  id?: string;
  title: string;
  description: string;
  inspiration: string;
  links: string;
  tags: string;
  next_steps: string;
  status: string;
  source_resource: string;
};
const stages = {
  idea: "Ideia",
  planning: "Planejando",
  building: "Em desenvolvimento",
  done: "Concluído",
};
const blank: Draft = {
  title: "",
  description: "",
  inspiration: "",
  links: "",
  tags: "",
  next_steps: "",
  status: "idea",
  source_resource: "",
};
const list = (value: string): string[] => {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const when = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "Não foi possível salvar. Tente novamente.");
  return data;
}

export function ProjectIdeas({
  user,
  resources,
  createRequest,
}: {
  user: User | null;
  resources: Resource[];
  createRequest: number;
}) {
  const [projects, setProjects] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [stage, setStage] = useState(""),
    [mine, setMine] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null),
    [formError, setFormError] = useState(""),
    [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null),
    [pendingDelete, setPendingDelete] = useState<Project | null>(null),
    [notice, setNotice] = useState("");
  const formId = useId();
  const initialDraft = useRef("");
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const dirty = !!draft && JSON.stringify(draft) !== initialDraft.current;
  const reload = useCallback(async () => {
    try {
      setProjects(await request<Project[]>("/api/projects"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (user) reload();
  }, [reload, user?.id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus();
      formErrorRef.current?.scrollIntoView({ block: "center" });
    }
  }, [formError]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [reload]);
  useEffect(() => {
    if (createRequest) {
      start();
    }
  }, [createRequest]);
  function start(project?: Project) {
    if (
      busy ||
      (dirty &&
        !window.confirm(
          "Descartar os campos ainda não salvos e começar outra ideia?",
        ))
    )
      return;
    const nextDraft = project
      ? {
          ...project,
          links: list(project.links).join("\n"),
          tags: list(project.tags).join(", "),
          source_resource: project.source_resource || "",
        }
      : { ...blank };
    initialDraft.current = JSON.stringify(nextDraft);
    setDraft(nextDraft);
    setFormError("");
    setNotice("");
  }
  function cancel() {
    if (dirty && !window.confirm("Descartar os campos desta edição?")) return;
    setDraft(null);
    setFormError("");
  }
  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (!stage || p.status === stage) &&
          (!mine || p.author === user?.id) &&
          normalize(
            [
              p.title,
              p.description,
              p.inspiration,
              p.author_name,
              ...list(p.tags),
            ].join(" "),
          ).includes(normalize(query)),
      ),
    [projects, stage, mine, user?.id, query],
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await request<{ id: string }>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          links: draft.links
            .split(/\r?\n/)
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      setDraft(null);
      setExpanded(result.id);
      setNotice("Ideia salva e disponível para o grupo.");
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await request(
        "/api/projects?id=" + encodeURIComponent(pendingDelete.id),
        { method: "DELETE" },
      );
      setPendingDelete(null);
      setNotice("Ideia excluída.");
      await reload();
    } catch (e) {
      setError((e as Error).message);
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  }
  function exportIdeas() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { exported: new Date().toISOString(), projects },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "devoteca-ideias-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(url);
  }
  const field = (key: keyof Draft, value: string) =>
    setDraft((previous) =>
      previous ? { ...previous, [key]: value } : previous,
    );
  return (
    <section className="projects-section" aria-label="Ideias de projetos">
      {notice && (
        <p className="projects-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button className="btn secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      )}
      {draft ? (
        <form className="project-form" onSubmit={save}>
          <div className="project-form-heading">
            <h2>{draft.id ? "Editar ideia" : "Nova ideia de projeto"}</h2>
            <button
              type="button"
              className="text-btn"
              onClick={cancel}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              Voltar às ideias
            </button>
          </div>
          <p className="project-form-intro">
            Comece pelo nome e pela descrição. Você pode completar o resto com o
            grupo depois.
          </p>
          {formError && (
            <p className="alert" role="alert" ref={formErrorRef} tabIndex={-1}>
              {formError}
            </p>
          )}
          <label htmlFor={formId + "-title"}>
            Nome do projeto <span>(obrigatório)</span>
          </label>
          <input
            id={formId + "-title"}
            value={draft.title}
            onChange={(e) => field("title", e.target.value)}
            maxLength={180}
            required
            autoFocus
            placeholder="Como vocês vão chamar o projeto?"
            disabled={busy}
          />
          <label htmlFor={formId + "-description"}>
            Descrição <span>(obrigatória)</span>
          </label>
          <textarea
            id={formId + "-description"}
            value={draft.description}
            onChange={(e) => field("description", e.target.value)}
            maxLength={6000}
            required
            rows={4}
            placeholder="O que o projeto faz, para quem e qual problema resolve?"
            disabled={busy}
          />
          <div className="project-form-pair">
            <div>
              <label htmlFor={formId + "-stage"}>Status</label>
              <select
                id={formId + "-stage"}
                value={draft.status}
                onChange={(e) => field("status", e.target.value)}
                disabled={busy}
              >
                {Object.entries(stages).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={formId + "-tags"}>
                Tecnologias / tags <span>(opcional)</span>
              </label>
              <input
                id={formId + "-tags"}
                value={draft.tags}
                onChange={(e) => field("tags", e.target.value)}
                maxLength={400}
                placeholder="React, Python, IA — separe por vírgulas"
                disabled={busy}
              />
            </div>
          </div>
          <label htmlFor={formId + "-inspiration"}>
            Inspiração <span>(opcional)</span>
          </label>
          <textarea
            id={formId + "-inspiration"}
            value={draft.inspiration}
            onChange={(e) => field("inspiration", e.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="De onde veio a ideia? O que vocês gostariam de adaptar ou explorar?"
            disabled={busy}
          />
          <label htmlFor={formId + "-source"}>
            Material da biblioteca que inspirou o projeto{" "}
            <span>(opcional)</span>
          </label>
          <select
            id={formId + "-source"}
            value={draft.source_resource}
            onChange={(e) => field("source_resource", e.target.value)}
            disabled={busy}
          >
            <option value="">Nenhum material selecionado</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <label htmlFor={formId + "-links"}>
            Links de inspiração <span>(opcional)</span>
          </label>
          <textarea
            id={formId + "-links"}
            value={draft.links}
            onChange={(e) => field("links", e.target.value)}
            rows={3}
            maxLength={22000}
            placeholder="https://github.com/autor/repositorio"
            aria-describedby={formId + "-links-help"}
            disabled={busy}
          />
          <small id={formId + "-links-help"}>
            Um link por linha, até 10 links. Use https:// ou http://.
          </small>
          <label htmlFor={formId + "-steps"}>
            Próximos passos <span>(opcional)</span>
          </label>
          <textarea
            id={formId + "-steps"}
            value={draft.next_steps}
            onChange={(e) => field("next_steps", e.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="Qual seria a primeira versão? O que falta pesquisar ou construir?"
            disabled={busy}
          />
          <div className="project-form-footer">
            <p>Todos os convidados podem editar esta ideia.</p>
            <div>
              <button
                type="button"
                className="btn secondary"
                onClick={cancel}
                disabled={busy}
              >
                Cancelar
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Plus size={17} />
                )}{" "}
                {busy ? "Salvando..." : "Salvar ideia"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="section-title">
            <h2>
              Projetos do grupo <span>{projects.length}</span>
            </h2>
            <div className="section-actions">
              <button
                className="icon-btn"
                aria-label="Exportar ideias em JSON"
                title="Exportar ideias em JSON"
                onClick={exportIdeas}
                disabled={loading || !projects.length}
              >
                <Download size={17} />
              </button>
              <button
                className="icon-btn"
                aria-label="Atualizar ideias"
                onClick={reload}
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </div>
          <div className="project-filters">
            <label className="searchbox" htmlFor="project-search">
              <Search size={18} />
              <input
                id="project-search"
                aria-label="Buscar ideias de projetos"
                placeholder="Buscar ideia, inspiração, tecnologia ou autor..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filtrar ideias por status"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(stages).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className={"pill " + (mine ? "selected" : "")}
              aria-pressed={mine}
              onClick={() => setMine(!mine)}
            >
              Minhas ideias
            </button>
          </div>
          {loading ? (
            <div className="projects-empty" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>Carregando ideias...</p>
            </div>
          ) : !filtered.length ? (
            <div className="projects-empty">
              <Lightbulb size={32} />
              <h3>
                {projects.length
                  ? "Nenhuma ideia com esses filtros"
                  : "Uma referência pode virar um projeto."}
              </h3>
              <p>
                {projects.length
                  ? "Tente outro termo ou remova os filtros para explorar as propostas."
                  : "Guarde uma proposta, conte o que inspirou você e combine os próximos passos com o grupo."}
              </p>
              {projects.length ? (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setQuery("");
                    setStage("");
                    setMine(false);
                  }}
                >
                  Limpar filtros
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => start()}
                  disabled={!user}
                >
                  <Plus size={17} />
                  Registrar primeira ideia
                </button>
              )}
            </div>
          ) : (
            <div className="project-list">
              {filtered.map((p) => (
                <article className="project-entry" key={p.id}>
                  <div className="project-entry-top">
                    <span className={"project-stage stage-" + p.status}>
                      {stages[p.status as keyof typeof stages] || p.status}
                    </span>
                    <small>
                      Por {p.author === user?.id ? "você" : p.author_name} ·
                      atualizado em {when(p.updated)}
                    </small>
                  </div>
                  <button
                    className="project-title"
                    aria-expanded={expanded === p.id}
                    aria-controls={"project-" + p.id}
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  >
                    <h3>{p.title}</h3>
                    <ChevronDown
                      size={18}
                      className={expanded === p.id ? "expanded" : ""}
                    />
                  </button>
                  <p
                    className={
                      "project-description " +
                      (expanded === p.id ? "" : "preview")
                    }
                  >
                    {p.description}
                  </p>
                  {!!list(p.tags).length && (
                    <div className="tags project-tags">
                      {list(p.tags).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  )}
                  {expanded === p.id && (
                    <div id={"project-" + p.id} className="project-details">
                      {p.inspiration && (
                        <div>
                          <h4>Inspiração</h4>
                          <p>{p.inspiration}</p>
                        </div>
                      )}
                      {p.source_resource && (
                        <div>
                          <h4>Material da biblioteca</h4>
                          <p className="project-source">
                            <BookOpen size={16} />
                            {p.source_title}
                            {p.source_url && (
                              <a
                                className="text-btn"
                                href={p.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Abrir material <ExternalLink size={14} />
                              </a>
                            )}
                          </p>
                        </div>
                      )}
                      {!!list(p.links).length && (
                        <div>
                          <h4>Links de inspiração</h4>
                          <ul className="project-links">
                            {list(p.links).map((url) => (
                              <li key={url}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {url}
                                  <ExternalLink size={14} />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {p.next_steps && (
                        <div>
                          <h4>Próximos passos</h4>
                          <p>{p.next_steps}</p>
                        </div>
                      )}
                      {!p.inspiration &&
                        !p.source_resource &&
                        !list(p.links).length &&
                        !p.next_steps && (
                          <p className="project-details-hint">
                            A proposta está começando. Edite para acrescentar
                            inspirações e próximos passos.
                          </p>
                        )}
                    </div>
                  )}
                  <div className="project-entry-actions">
                    <button
                      className="text-btn"
                      onClick={() =>
                        setExpanded(expanded === p.id ? null : p.id)
                      }
                    >
                      {expanded === p.id ? "Recolher" : "Ver ideia completa"}
                    </button>
                    <div>
                      <button
                        className="text-btn"
                        onClick={() => start(p)}
                        disabled={!user}
                        aria-label={"Editar ideia " + p.title}
                      >
                        <Pencil size={15} />
                        Editar
                      </button>
                      {(p.author === user?.id || user?.admin) && (
                        <button
                          className="icon-btn"
                          aria-label={"Excluir ideia " + p.title}
                          onClick={() => setPendingDelete(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog.Root
        open={!!pendingDelete}
        onOpenChange={(v) => !v && !busy && setPendingDelete(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="modal project-delete">
            <header className="modal-header">
              <div>
                <Dialog.Title>Excluir ideia?</Dialog.Title>
                <Dialog.Description>
                  “{pendingDelete?.title}” será removida para todo o grupo. Esta
                  ação não pode ser desfeita.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className="icon-btn"
                  aria-label="Fechar"
                  disabled={busy}
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </header>
            <div className="project-delete-actions">
              <button
                className="btn secondary"
                onClick={() => setPendingDelete(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button className="btn danger" onClick={remove} disabled={busy}>
                {busy ? "Excluindo..." : "Excluir ideia"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
