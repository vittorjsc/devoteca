"use client";
import { useState } from "react";
import { Languages, ExternalLink, FileText, Download } from "lucide-react";
import {
  translatedPageUrl,
  translatedTextUrl,
  translatedDocumentUrl,
} from "@/lib/translation";

type Material = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  file_key: string | null;
  file_name: string | null;
  file_size: number | null;
};

export function TranslationPanel({ material }: { material: Material }) {
  const [text, setText] = useState(material.description || "");
  const page = translatedPageUrl(material.url);
  const snippet = translatedTextUrl(text);
  const documentSupported =
    !!material.file_name &&
    /\.(pdf|docx|pptx|xlsx)$/i.test(material.file_name) &&
    (material.file_size || 0) <= 10 * 1024 * 1024;
  return (
    <div className="translation-panel">
      <div className="translation-intro">
        <Languages size={22} />
        <div>
          <strong>{material.title}</strong>
          <p>Leia em português com o Google Tradutor.</p>
        </div>
      </div>
      {page && (
        <section className="translation-page">
          <h3>Página do material</h3>
          <p>Abra o site, artigo ou repositório com tradução para português.</p>
          <a
            className="btn primary"
            href={page}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Languages size={17} />
            Traduzir página
            <ExternalLink size={14} />
          </a>
          <small>
            Páginas que exigem login ou bloqueiam tradução podem não abrir.
            Nesse caso, copie um trecho abaixo.
          </small>
        </section>
      )}
      <section className="translation-text">
        <label htmlFor="translation-text">
          <FileText size={17} />
          Descrição ou trecho
        </label>
        <textarea
          id="translation-text"
          rows={4}
          maxLength={5000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Cole um trecho do README, artigo ou documento em inglês..."
        />
        <div className="translation-text-actions">
          <small>
            {text.length.toLocaleString("pt-BR")} / 5.000 caracteres
          </small>
          {snippet ? (
            <a
              className="btn secondary"
              href={snippet}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Languages size={16} />
              Traduzir trecho
              <ExternalLink size={14} />
            </a>
          ) : (
            <button className="btn secondary" disabled>
              <Languages size={16} />
              Traduzir trecho
            </button>
          )}
        </div>
      </section>
      {material.file_key && (
        <section className="translation-file">
          <h3>Arquivo anexado</h3>
          <p>
            {documentSupported
              ? "Baixe o arquivo e escolha-o na aba Documentos do Google Tradutor, em um computador."
              : "Para este formato ou tamanho, copie um trecho do arquivo para traduzir acima."}
          </p>
          <div className="detail-links">
            <a
              className="btn secondary"
              href={"/api/files?id=" + encodeURIComponent(material.id)}
            >
              <Download size={16} />
              Baixar arquivo
            </a>
            {documentSupported && (
              <a
                className="btn secondary"
                href={translatedDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Traduzir documento
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {documentSupported && (
            <small>
              PDF, DOCX, PPTX ou XLSX até 10 MB. PDFs: até 300 páginas. Texto
              escaneado não é traduzido.
            </small>
          )}
        </section>
      )}
      <p className="translation-note">
        A tradução abre em outra aba. O link ou texto escolhido será enviado ao
        Google quando você abrir uma opção. Anexos não são enviados
        automaticamente.
      </p>
    </div>
  );
}
