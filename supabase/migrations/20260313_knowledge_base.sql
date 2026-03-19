-- Habilitar extensão vetorial
create extension if not exists vector;

-- Tabela de controle de documentos (metadados dos PDFs)
create table if not exists knowledge_documents (
  id           uuid primary key default gen_random_uuid(),
  agent_type   text not null check (agent_type in ('morador', 'zelador', 'prestador', 'sindico')),
  file_name    text not null,
  file_path    text not null,
  status       text not null default 'processing' check (status in ('processing', 'active', 'error')),
  chunk_count  int default 0,
  error_msg    text,
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Tabela de vetores — morador
create table if not exists morador_knowledge (
  id           bigserial primary key,
  document_id  uuid references knowledge_documents(id) on delete cascade,
  content      text not null,
  embedding    vector(1536),
  metadata     jsonb default '{}',
  created_at   timestamptz default now()
);
create index if not exists morador_knowledge_embedding_idx on morador_knowledge using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Tabela de vetores — zelador
create table if not exists zelador_knowledge (
  id           bigserial primary key,
  document_id  uuid references knowledge_documents(id) on delete cascade,
  content      text not null,
  embedding    vector(1536),
  metadata     jsonb default '{}',
  created_at   timestamptz default now()
);
create index if not exists zelador_knowledge_embedding_idx on zelador_knowledge using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Tabela de vetores — prestador
create table if not exists prestador_knowledge (
  id           bigserial primary key,
  document_id  uuid references knowledge_documents(id) on delete cascade,
  content      text not null,
  embedding    vector(1536),
  metadata     jsonb default '{}',
  created_at   timestamptz default now()
);
create index if not exists prestador_knowledge_embedding_idx on prestador_knowledge using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Tabela de vetores — síndico
create table if not exists sindico_knowledge (
  id           bigserial primary key,
  document_id  uuid references knowledge_documents(id) on delete cascade,
  content      text not null,
  embedding    vector(1536),
  metadata     jsonb default '{}',
  created_at   timestamptz default now()
);
create index if not exists sindico_knowledge_embedding_idx on sindico_knowledge using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Funções de busca semântica por agente
create or replace function match_morador_knowledge(query_embedding vector(1536), match_threshold float default 0.7, match_count int default 5)
returns table(id bigint, content text, metadata jsonb, similarity float) language sql stable as $$
  select id, content, metadata, 1 - (embedding <=> query_embedding) as similarity
  from morador_knowledge
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc limit match_count;
$$;

create or replace function match_zelador_knowledge(query_embedding vector(1536), match_threshold float default 0.7, match_count int default 5)
returns table(id bigint, content text, metadata jsonb, similarity float) language sql stable as $$
  select id, content, metadata, 1 - (embedding <=> query_embedding) as similarity
  from zelador_knowledge
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc limit match_count;
$$;

create or replace function match_prestador_knowledge(query_embedding vector(1536), match_threshold float default 0.7, match_count int default 5)
returns table(id bigint, content text, metadata jsonb, similarity float) language sql stable as $$
  select id, content, metadata, 1 - (embedding <=> query_embedding) as similarity
  from prestador_knowledge
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc limit match_count;
$$;

create or replace function match_sindico_knowledge(query_embedding vector(1536), match_threshold float default 0.7, match_count int default 5)
returns table(id bigint, content text, metadata jsonb, similarity float) language sql stable as $$
  select id, content, metadata, 1 - (embedding <=> query_embedding) as similarity
  from sindico_knowledge
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc limit match_count;
$$;

-- RLS: somente superadmin pode gerenciar documentos
alter table knowledge_documents enable row level security;

-- Policy (create or replace safe)
drop policy if exists "superadmin_manage_documents" on knowledge_documents;
create policy "superadmin_manage_documents" on knowledge_documents
  for all using (
    exists (select 1 from profiles where user_id = auth.uid() and profile_type = 'superadmin')
  );

-- Criação Automática do Bucket de Storage
insert into storage.buckets (id, name, public) 
values ('knowledge-pdfs', 'knowledge-pdfs', false) 
on conflict (id) do nothing;

-- Adicionando Políticas de Segurança RLS para o novo Bucket (Substitui se já existir)
drop policy if exists "Superadmin can manage PDFs" on storage.objects;
create policy "Superadmin can manage PDFs" on storage.objects for all to authenticated using (
  bucket_id = 'knowledge-pdfs' and
  exists (select 1 from public.profiles where user_id = auth.uid() and profile_type = 'superadmin')
);

drop policy if exists "Authenticated users can read PDFs" on storage.objects;
create policy "Authenticated users can read PDFs" on storage.objects for select to authenticated using (
  bucket_id = 'knowledge-pdfs'
);
