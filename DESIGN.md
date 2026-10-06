---
name: Devoteca
description: Biblioteca e comunidade privadas em português, com navegação escura e conteúdo claro.
colors:
  ink: "#19242d"
  text-secondary: "#536372"
  line: "#e2e7eb"
  accent: "#3358e6"
  action-blue: "#3558e7"
  action-hover: "#2748ce"
  surface: "#fff"
  surface-subtle: "#f6f8fa"
  sidebar-navy: "#101d2c"
  nav-text: "#aebdce"
  nav-hover: "#1b2b3d"
  nav-active-background: "#283b36"
  nav-active-text: "#d5f8a2"
  brand-lime: "#c6ef78"
  focus-outline: "#86a5ff"
  field-border: "#dbe3ea"
  field-text: "#27384a"
  selected-background: "#e8eefc"
  selected-text: "#2547b6"
typography:
  headline:
    fontSize: "31px"
    fontWeight: 680
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  description:
    fontSize: "15px"
    lineHeight: 1.65
  label:
    fontSize: "14px"
    fontWeight: 600
  metadata:
    fontSize: "12px"
rounded:
  field: "6px"
  control: "7px"
  card: "12px"
  dialog: "13px"
spacing:
  page: "clamp(24px, 3vw, 42px)"
  content-top: "32px"
  mobile-page: "20px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.field-text}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  navigation-active:
    backgroundColor: "{colors.nav-active-background}"
    textColor: "{colors.nav-active-text}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
  resource-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

# Design System: Devoteca

## Overview

A direção atual é uma biblioteca de trabalho compartilhada: navegação azul-marinho, indicação ativa em verde-lima e superfícies claras para ler, buscar e contribuir. Esta documentação captura a interface existente após o refinamento de UX; não estabelece uma nova identidade.

O nome Devoteca e o português são compromissos do produto. A densidade é prática, com cartões legíveis e controles comuns entre biblioteca, feed e projetos.

**Key Characteristics:**
- Navegação principal consistente entre as cinco seções.
- Azul para ações e verde-lima para identidade e navegação ativa.
- Conteúdo claro, descrições legíveis e metadados discretos.
- Estados de foco visíveis e ações de formulário protegidas durante o salvamento.

## Colors

Os valores normativos estão no frontmatter; a origem é `app/globals.css`.

### Primary

O azul de ação identifica os botões principais; sua variante mais escura indica hover. O token accent permanece usado em foco e detalhes. Os dois azuis próximos já coexistem na implementação: não são intercambiáveis por pressuposição.

### Secondary

O verde-lima identifica a marca e a navegação ativa sobre o azul-marinho. A seleção de filtros usa uma superfície azul clara com texto azul escuro.

### Neutral

Ink é o texto principal. Text-secondary é compartilhado por descrições, metadados de cartões, ajuda e textos auxiliares dos formulários; apresenta contraste de 6,18:1 sobre branco. Surface e surface-subtle separam cartões e área de trabalho. Line e field-border delimitam conteúdo e campos.

As cores auxiliares da barra lateral pertencem ao contexto escuro; não devem ser copiadas para metadados sobre branco.

## Typography

A pilha de fontes é Inter, Segoe UI, Arial e sans-serif. O código declara Inter sem garantir seu carregamento; preserve os fallbacks.

O título principal usa o papel headline e passa a 28px no mobile. Body é a base da página e dos campos de formulário; description atende descrições de cartões e cabeçalhos. Labels e botões usam 14px. Os metadados compartilhados refinados usam pelo menos 12px; pequenos elementos legados de marca e indicadores ainda têm tamanhos próprios.

Descrições de cabeçalho têm largura máxima de 65ch. Títulos longos de materiais, projetos e referências do feed podem quebrar palavras para evitar transbordamento.

## Layout

No desktop, a barra lateral fixa ocupa 254px; o conteúdo desloca-se pela mesma largura. O conteúdo usa espaçamento lateral page e 32px no topo. Os cartões da biblioteca formam uma grade automática com largura mínima de 265px quando há espaço.

Até 850px, a navegação fixa inferior mostra Feed, Biblioteca, Projetos, Pessoas e Perfil em cinco colunas. O conteúdo usa 20px nas laterais e reserva 100px mais a área segura inferior. A biblioteca passa a uma coluna; busca continua visível e o botão Filtros revela opções avançadas e ordenação. Entre 851px e 1050px, cabeçalho e busca permitem quebra.

A leitura começa pelo destino e seus controles. Biblioteca apresenta busca, filtros e resultados antes dos contadores de visão geral. Categorias e atalhos específicos ficam no contexto da biblioteca.

## Elevation & Depth

A interface combina bordas finas e superfícies tonais, com sombra sutil em ações e hover de cartões. Modais usam sombra mais forte para separação. Os valores completos de sombra estão no sidecar; não há uma escala universal de elevação inventada.

Transições existentes de navegação e botões duram 0,15s. A folha de estilos respeita a preferência por movimento reduzido.

## Shapes

Campos têm cantos discretos (field), controles usam control, cartões de conteúdo usam card e diálogos usam dialog. Avatares circulares e a marca mantêm suas formas próprias. O token legado --radius (0,65rem) permanece no código e não substitui automaticamente esses valores observados.

## Components

### Buttons

Ações principais são azuis, com texto branco e hover mais escuro. Botões comuns têm altura mínima de 44px; ícones e ações textuais têm alvos mínimos de 40px. No cabeçalho mobile, o mínimo é 42px. Botões desabilitados usam opacidade de 0,55 e cursor apropriado.

### Inputs / Fields

Campos claros têm borda fina e texto escuro. Formulários usam fonte de 16px; campos de busca e seleção também passam a 16px no mobile. O foco de teclado usa contorno de 3px com afastamento de 3px. Durante salvamento de material, os campos são desabilitados e o fechamento fica bloqueado; descartar alterações exige confirmação.

### Cards / Containers

Cartões claros têm bordas leves e cantos suaves. Descrições usam o papel description, enquanto autoria e data seguem metadata. Foco dentro de um cartão altera sua borda. Listas e cartões continuam opções do acervo.

### Chips

Filtros têm altura mínima de 38px e texto de 14px; seleção usa o par azul claro/azul escuro do frontmatter. Filtros ativos apresentam contagem de resultados e a ação Limpar filtros.

### Navigation

A barra principal mantém os mesmos cinco destinos no desktop e mobile, com rótulo e ícone. A seção ativa recebe o par verde sobre superfície escura e aria-current. Ctrl+K ou Command+K abre Biblioteca e foca a busca, exceto quando um diálogo está aberto. O primeiro link de teclado permite ir diretamente ao conteúdo.

## Do's and Don'ts

### Do:
- **Do** preserve a navegação principal e os papéis distintos de azul e verde-lima.
- **Do** use os controles compartilhados, foco visível e os textos auxiliares legíveis.
- **Do** verifique nomes longos e a área segura da navegação inferior em telas pequenas.
- **Do** preserve listas visíveis durante atualização de projetos em segundo plano.

### Don't:
- **Don't** copie cinzas da barra lateral para texto auxiliar em superfícies claras.
- **Don't** remova os rótulos da navegação mobile ou a reserva inferior do conteúdo.
- **Don't** trate o refinamento visual como autorização para alterar acesso ou permissões do produto.
