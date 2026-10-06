# Segurança da Devoteca

Revisão técnica em 6 de outubro de 2026. O objetivo é reduzir exposição de dados, alterações indevidas e abuso sem mudar a colaboração do grupo.

## Acesso e permissões

O Sites autentica a conta ChatGPT e verifica os convites antes de encaminhar requisições ao Worker. Copiar o link não concede acesso. A aplicação exige a identidade fornecida pela plataforma em todas as APIs. Não publique este Worker por um endpoint alternativo sem essa proteção: seus cabeçalhos de identidade dependem da validação do dispatcher, não são credenciais por si só. O preview com identidade simulada é somente local e não está no build publicado.

Autores ou administrador editam/excluem materiais e publicações; cada pessoa edita seu próprio perfil. Qualquer convidado edita ideias, conforme a regra escolhida pelo grupo; somente autor ou administrador as exclui. Somente o administrador exclui categorias. Favoritos e progresso são individuais. A conta de captura da plataforma não pode alterar conteúdo.

## Proteções implementadas

- Operações de escrita exigem `Origin` da própria aplicação, com `Referer` da mesma origem como alternativa. Pedidos marcados como `cross-site` ou `same-site` são bloqueados; ausência de ambos os cabeçalhos também é bloqueada. JSON exige `application/json` e um objeto válido.
- JSON é limitado a 64 KB antes de ser interpretado; uploads binários são limitados durante a leitura, inclusive sem `Content-Length`. Fotos: 5 MB. Anexos: 20 MB. Formulários de material têm mais 64 KB para campos e separadores.
- Limites por identidade são persistidos em D1 com atualização atômica: 120 tentativas de escrita por minuto, 100 uploads por hora e 250 MB enviados por dia. São janelas fixas UTC, não proteção contra todo tipo de ataque de disponibilidade. Tentativas autorizadas que falhem na validação contam; envios bloqueados preservam o formulário. A resposta 429 informa `Retry-After`.
- Anexos têm extensão permitida, validação de assinatura para formatos binários e bloqueio de nomes com caminhos/caracteres de controle. Downloads exigem autenticação e são entregues como `attachment`, `application/octet-stream`, `nosniff`, sem cache e com política de sandbox. Fotos aceitam assinaturas de JPG/PNG/WebP; SVG/HTML são recusados. Fotos ainda sem vínculo só podem ser lidas pelo remetente.
- Respostas privadas usam `private, no-store`, sem CORS permissivo. `no-referrer` evita enviar a origem da biblioteca a links externos. CSP bloqueia objetos incorporados e restringe formulários, base de URLs e incorporação da página às origens previstas; ela não é uma política estrita de scripts. Recursos de câmera, microfone e geolocalização são desativados; indexação por buscadores é desencorajada.
- E-mails de membros e chaves reais de objetos no R2 não são retornados pelo catálogo. O indicador `file_key: "attached"` conserva a compatibilidade da interface sem revelar a chave. A ausência de nome não usa mais o e-mail como nome público automático. Nomes personalizados continuam sendo uma escolha da própria pessoa.
- Consultas usam parâmetros SQL. Textos do grupo são renderizados como texto pelo React; não são inseridos como HTML. Links aceitam HTTP/HTTPS, sem credenciais. A consulta de metadados usa apenas a API pública fixa do GitHub, sem seguir redirecionamentos.
- Erros inesperados não devolvem detalhes técnicos ao navegador e seus logs não incluem o objeto da exceção, parâmetros SQL, textos privados ou cabeçalhos de requisição.
- Credenciais, bancos locais, registros de ferramentas e dados de teste ficam fora do Git. O repositório de portfólio usa configuração genérica e exemplos locais, sem os convites e dados do grupo.

## Verificação

Pedidos anônimos com cabeçalhos de identidade falsificados foram recusados (401) pelo Site em três APIs: biblioteca, feed e fotos. Foi uma verificação de leitura, sem alteração de dados online. Os testes locais do Worker usam identidades simuladas e não substituem essa verificação da plataforma.

`tests/security.mjs` verifica APIs privadas, ausência/origem estrangeira e metadados de navegação, tamanhos declarados e enviados em stream, corpos malformados, dados minimizados, downloads, binários renomeados, conta de captura sem escrita e limite de 125 pedidos simultâneos. `integration.mjs`, `projects.mjs` e `community.mjs` verificam o funcionamento e permissões de usuários distintos. Todos recusam URLs fora do localhost.

Execute a suíte de segurança com `node tests/security-worker.mjs`: esse runner usa o Worker compilado e D1/R2 descartáveis diretamente no Miniflare. Também verifica as cotas de quantidade e bytes com contadores de teste. Isso evita resets do proxy HTTP de preview ao devolver respostas sem ler um corpo recusado; no Windows, a mensagem desse proxy pode sugerir um reinício que não aconteceu. Os outros três testes também foram executados pela interface HTTP do Worker local. Não há escrita de teste na publicação.

As dependências com correções disponíveis foram atualizadas, incluindo Next 16.3.6, React/RSC 19.2.8, Vite 8.0.16, sharp 0.35.5, esbuild 0.28.1, undici 7.29.1, ws 8.21.0 e image-size 2.0.3. O resultado de `npm audit --omit=dev` foi zero alertas nesta revisão. Há um alerta sem versão corrigida no registro npm para `braces` 3.0.3, propagado por ferramentas de build/lint. A aplicação não recebe padrões de glob de visitantes; o pacote não aparece no Worker compilado. Não execute ferramentas de desenvolvimento com padrões/código de pessoas não confiáveis nem exponha o preview à internet. A correção desse fornecedor permanece pendente; não foi feita uma atualização forçada para versões incompatíveis.

## Limites e cuidados do grupo

Esta revisão não é uma investigação de incidentes passados e não demonstra ausência de vazamentos históricos. Não é certificação de segurança absoluta. A autenticação, disponibilidade, criptografia e recuperação da infraestrutura dependem do Sites/Cloudflare; não foi auditada essa infraestrutura internamente nem testada recuperação de backup.

Convidados podem ler e baixar conteúdo compartilhado; o sistema não impede que uma pessoa autorizada o copie para fora. Revogar o acesso não apaga cópias já baixadas. A exportação do catálogo não é backup completo de anexos/comentários.

Não há antivírus nem análise do conteúdo de ZIPs, macros ou PDFs: assinatura válida não garante arquivo seguro. Imagens originais podem conter metadados EXIF, inclusive localização; remova-os antes de compartilhar fotos sensíveis. A tradução envia o trecho/link escolhido ao Google quando a pessoa abre a opção, conforme aviso existente; não use essa opção para segredos ou dados privados. Nenhum anexo é enviado automaticamente para tradução ou análise externa.

Não compartilhe senhas, tokens, dados pessoais desnecessários ou conteúdo privado de terceiros. Avise o administrador sobre publicação abusiva ou acesso indevido; ele pode remover conteúdo e revogar convites pela configuração do Sites. Em caso de credencial exposta, revogue-a no serviço de origem, preserve evidências e remova a publicação. Não publique evidências contendo o segredo no GitHub.

Referências: [OWASP: CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [cabeçalhos HTTP](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [alerta de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
