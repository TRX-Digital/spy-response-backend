# Spy Response Backend

Backend Node.js com Express e TypeScript para o app Spy Response. Ele foi criado para rodar fora do Lovable, por exemplo no Railway, e acessar o Supabase com `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor.

## Stack

- Node.js
- Express
- TypeScript
- Supabase JS
- cors
- dotenv
- zod

## Como rodar local

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

3. Preencha as variaveis do Supabase e do front-end:

```env
PORT=3000
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_JWT_SECRET=
FRONTEND_URL=https://seu-app-lovable.lovable.app
NODE_ENV=development
OPENAI_API_KEY=sua_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_DEEP_MODEL=gpt-5.5
YOUTUBE_API_KEY=sua_youtube_api_key
YOUTUBE_MAX_RESULTS=10
SERPAPI_KEY=sua_serpapi_key
SERPAPI_MAX_QUERIES=3
APIFY_TOKEN=seu_apify_token
APIFY_TIKTOK_ACTOR=clockworks/tiktok-scraper
TIKTOK_MAX_RESULTS=50
APIFY_META_ADS_ACTOR=curious_coder/facebook-ads-library-scraper
META_ADS_MAX_RESULTS=30
META_ADS_ENABLED=true
```

4. Inicie em modo desenvolvimento:

```bash
npm run dev
```

## Producao

```bash
npm run build
npm start
```

## Variaveis de ambiente

- `PORT`: porta do servidor. Padrao: `3000`.
- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave service role usada somente no backend.
- `SUPABASE_JWT_SECRET`: opcional nesta etapa. A autenticacao usa `supabase.auth.getUser(token)`.
- `FRONTEND_URL`: origem liberada no CORS.
- `NODE_ENV`: `development`, `production` ou `test`.
- `OPENAI_API_KEY`: chave da OpenAI usada somente no backend.
- `OPENAI_MODEL`: modelo padrao para expansao de termos e analise de criativos.
- `OPENAI_DEEP_MODEL`: modelo usado para diagnostico de mercado.
- `YOUTUBE_API_KEY`: chave da YouTube Data API usada somente no backend.
- `YOUTUBE_MAX_RESULTS`: quantidade maxima de Shorts salvos por busca.
- `SERPAPI_KEY`: chave da SerpApi usada somente no backend para Google Trends.
- `SERPAPI_MAX_QUERIES`: quantidade maxima de termos comparados no Google Trends.
- `APIFY_TOKEN`: token da Apify usado somente no backend para TikTok e Meta Ads.
- `APIFY_TIKTOK_ACTOR`: actor da Apify usado para coletar TikTok.
- `TIKTOK_MAX_RESULTS`: tamanho da amostra coletada antes de salvar o top 10.
- `APIFY_META_ADS_ACTOR`: actor da Apify usado para coletar Meta Ads Library.
- `META_ADS_MAX_RESULTS`: tamanho da amostra coletada antes de salvar o top 10.
- `META_ADS_ENABLED`: habilita ou desabilita a coleta real de Meta Ads.

O front-end deve enviar o access token do Supabase:

```http
Authorization: Bearer <supabase_access_token>
```

## Endpoints

### GET `/api/health`

Retorna status do servico e se o Supabase esta configurado.

Tambem retorna `openai` como `connected` quando `OPENAI_API_KEY` existir ou `pending` quando ainda nao estiver configurada.

Retorna `youtube_data_api` como `pending`, `connected` ou `error`, conforme configuracao e ultimo uso da YouTube Data API.

Retorna `serpapi_google_trends` como `pending`, `connected` ou `error`, conforme configuracao e ultimo uso do Google Trends via SerpApi.

Retorna `tiktok_api` como `pending`, `connected` ou `error`, conforme configuracao e ultimo uso do Apify TikTok Scraper.

Retorna `meta_ads_api` como `pending`, `connected` ou `error`, conforme configuracao e ultimo uso do Apify Meta Ads Library Scraper.

### POST `/api/search`

Requer `Authorization: Bearer <token>`.

Body:

```json
{
  "topic": "postres para vender",
  "language": "Espanhol",
  "period": "30"
}
```

Cria uma busca em `public.searches` e dados mockados nas tabelas relacionadas.

Resposta:

```json
{
  "searchId": "<id criado>"
}
```

### GET `/api/search/:id`

Requer `Authorization: Bearer <token>`.

Busca a pesquisa do usuario autenticado e retorna:

```json
{
  "search": {},
  "keywordExpansions": [],
  "trendResults": {
    "tiktok": [],
    "youtube_shorts": []
  },
  "sourceResults": {
    "tiktok": [],
    "youtube_shorts": []
  },
  "adResults": [],
  "marketDiagnosis": {},
  "auditLogs": []
}
```

### POST `/api/analyze/content`

Requer `Authorization: Bearer <token>`.

Body:

```json
{
  "contentId": "mock-tiktok-001",
  "source": "tiktok"
}
```

Retorna uma analise mockada de hook, promessa, dor, audiencia e adaptacoes.

## Deploy no Railway

1. Crie um novo projeto no Railway conectado ao repositorio.
2. Configure as variaveis de ambiente no painel do Railway.
3. Use os comandos:

```bash
npm run build
npm start
```

4. Defina `NODE_ENV=production`.
5. Configure `FRONTEND_URL` com a URL exata do app Lovable para liberar o CORS.

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no front-end.
