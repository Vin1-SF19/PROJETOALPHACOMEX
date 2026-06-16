# Resumo do Projeto PainelAlpha

## Visão Geral
O PainelAlpha é uma aplicação moderna de gerenciamento desenvolvida com Next.js, TypeScript, Tailwind CSS e Prisma. O projeto integra funcionalidades de upload de skills, chat Bibble, geração de fichas e outras funcionalidades de gerenciamento.

## Estrutura do Projeto
- **Framework**: Next.js 14.0.0
- **Linguagem**: TypeScript 5.0.0
- **Estilização**: Tailwind CSS 3.3.0
- **ORM**: Prisma 5.0.0
- **Runtime**: Node.js 20.0.0

## Diretórios Principais
- `src/app` - Rotas da aplicação
- `src/components` - Componentes React
- `src/lib` - Bibliotecas e serviços
- `prisma` - Configurações do Prisma
- `public` - Arquivos estáticos
- `src/styles` - Estilos globais

## Funcionalidades Principais
1. **Gerenciamento de Skills** - Upload e gerenciamento de skills
2. **Chat Bibble** - Integração com assistente IA
3. **Geração de Fichas** - Criação de fichas para diferentes contextos
4. **Upload de Arquivos** - Sistema de upload de documentos

## Endpoints API Principais
- `/api/UploadSkills` - Upload de skills
- `/api/bibble/chat` - Chat Bibble
- `/api/bibble/gerar-ficha` - Geração de fichas
- `/api/bibble/documents` - Documentos Bibble
- `/api/bibble/models` - Modelos Bibble
- `/api/bibble/projects` - Projetos Bibble
- `/api/bibble/sessions` - Sessões Bibble
- `/api/bibble/upload-to-blob` - Upload para blob Bibble
- `/api/bibble/upload` - Upload Bibble

## Tecnologias e Ferramentas
- Next.js 14 (App Router)
- TypeScript para tipagem estática
- Tailwind CSS para estilização
- Prisma para acesso ao banco de dados
- React 18
- Node.js 20