# Design: Obsidian Second Brain — Skill + CLAUDE.md Integration

**Data:** 2026-04-15
**Status:** Aprovado

---

## Problema

Os profiles Claude (`.claude-pj/`, `.claude-bizpik/`, `.claude/`) não tinham nenhuma instrução sobre o vault Obsidian. A IA chegava em cada sessão sem contexto, precisava perguntar ao usuário sobre o estado dos projetos, ou simplesmente ignorava a memória persistente já existente no vault.

O vault já tem `CLAUDE.md` na raiz com instrução de `vault_bootstrap`, mas isso só funciona quando o vault é o working directory — não quando a IA está em outro projeto.

---

## Solução: Abordagem B — Skill dedicado + referência no CLAUDE.md

### Skill: `obsidian-second-brain`

**Localização:** `Obsidian-MCP/skills/obsidian-second-brain/SKILL.md`

**Responsabilidade única:** bootstrap de sessão via vault como segundo cérebro.

**Trigger automático:** sessão nova, menção a Obsidian, vault, segundo cérebro, memória, sessão anterior, projeto ativo.

#### Comportamento na abertura de sessão

1. Chama `vault_bootstrap` imediatamente — sem perguntar nada ao usuário
2. Recebe em uma chamada: guia completo do vault + projetos ativos (`MOC_Missao_Ativa`)
3. Se o working dir corresponder a um projeto ativo → abre `Estado_Atual` daquele projeto automaticamente
4. Age com o contexto carregado como fonte de verdade

#### Comportamento durante a sessão

- Vault = fonte de verdade absoluta para contexto e memória
- Nunca hardcode paths ou nome de usuário (usa o retorno do `vault_bootstrap`)
- Nunca acessa `900-999` sem pedido explícito do usuário

#### Comportamento no encerramento

Ao final de qualquer sessão significativa:

1. Atualiza `Estado_Atual` do projeto (tabelas de status, pendências, próximo passo)
2. Cria nota de sessão em `700-799_Operacao_e_Memoria_IA/710_Projetos/<ID>/Sessoes/<ID>_Sessao_YYYY-MM-DD_HHmm.md`
3. Atualiza `Handoff` conforme a regra do projeto (pilha LIFO de 5 sessões ou arquivo contínuo)
4. Atualiza `MOC_Missao_Ativa` com status e link do último handoff

---

### CLAUDE.md dos 3 profiles

Cada um dos 3 diretórios recebe um bloco adicional no CLAUDE.md:

- `~/.claude/CLAUDE.md` (global default)
- `~/.claude-pj/CLAUDE.md`
- `~/.claude-bizpik/CLAUDE.md`

**Conteúdo do bloco:**

```markdown
## Obsidian — Segundo Cérebro

O vault Obsidian é a memória persistente e fonte de verdade deste ecossistema.

**Ao iniciar qualquer sessão:** invoque o skill `obsidian-second-brain`.
Ele chama `vault_bootstrap` automaticamente e carrega todo o contexto necessário
sem precisar perguntar nada ao usuário.
```

---

## Estrutura de arquivos a criar/modificar

```
Obsidian-MCP/
  skills/
    obsidian-second-brain/
      SKILL.md              ← criar
  docs/
    superpowers/
      specs/
        2026-04-15-obsidian-second-brain-design.md  ← este arquivo

~/.claude/CLAUDE.md         ← adicionar bloco Obsidian
~/.claude-pj/CLAUDE.md      ← adicionar bloco Obsidian
~/.claude-bizpik/CLAUDE.md  ← adicionar bloco Obsidian
```

---

## Decisões de design

- **Skill separado do `obsidian/SKILL.md` existente:** papéis distintos — operações MCP vs. bootstrap de sessão
- **`vault_bootstrap` como ponto de entrada único:** uma chamada retorna tudo; não precisamos ler 8 arquivos da pasta 500 manualmente
- **CLAUDE.md lean:** instrução mínima nos profiles, detalhe todo no skill
- **Sem menção a sistemas de memória locais:** problema já resolvido externamente
